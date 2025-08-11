import os
import json
import requests
import re
from google import genai
import subprocess

GITLAB_PROJECT_ID = os.getenv('CI_MERGE_REQUEST_PROJECT_ID')
GITLAB_MR_IID = os.getenv('CI_MERGE_REQUEST_IID')
GITLAB_API_URL = os.getenv('CI_API_V4_URL')
GITLAB_TOKEN = os.getenv('GITLAB_TOKEN')
GEMINI_API_KEY_QA1 = os.getenv('GEMINI_API_KEY_QA1')
BOT_COMMENT_HEADER = "✨ **MR Summary by Gemini:**"
CI_PROJECT_DIR = os.getenv('CI_PROJECT_DIR')

MAX_PROMPT_CHARS = 800000
MAX_FILES_TO_ANALYZE = 40

def get_mr_details():
    if not all([GITLAB_PROJECT_ID, GITLAB_MR_IID, GITLAB_TOKEN]):
        print("Error: Missing GitLab environment variables.")
        return None, None, None, None
    headers = {"PRIVATE-TOKEN": GITLAB_TOKEN}
    mr_url = f"{GITLAB_API_URL}/projects/{GITLAB_PROJECT_ID}/merge_requests/{GITLAB_MR_IID}"
    changes_url = f"{mr_url}/changes"

    try:
        mr_response = requests.get(mr_url, headers=headers)
        mr_response.raise_for_status()
        mr_data = mr_response.json()

        changes_response = requests.get(changes_url, headers=headers)
        changes_response.raise_for_status()
        changes_data = changes_response.json()
        
        mr_title = mr_data.get('title', '')
        mr_description = mr_data.get('description', '')

        return mr_data, changes_data['changes'], mr_title, mr_description
    except requests.exceptions.RequestException as e:
        print(f"Error fetching data from GitLab: {e}")
        return None, None, None, None

def get_existing_summary_comment_id(project_id, mr_iid, api_url, gitlab_token):
    url = f"{api_url}/projects/{project_id}/merge_requests/{mr_iid}/notes"
    headers = {"PRIVATE-TOKEN": gitlab_token}
    
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        notes = response.json()
        
        for note in notes:
            if not note.get('position') and note['body'].startswith(BOT_COMMENT_HEADER):
                return note['id']
        return None
    except requests.exceptions.RequestException as e:
        print(f"Error checking for existing summary comment: {e}")
        print(f"Response Body: {e.response.text if hasattr(e.response, 'text') else 'N/A'}")
        return None

def get_file_content_from_gitlab(project_id, file_path, ref_sha, api_url, gitlab_token):
    encoded_file_path = requests.utils.quote(file_path, safe='')
    url = f"{api_url}/projects/{project_id}/repository/files/{encoded_file_path}/raw?ref={ref_sha}"
    headers = {"PRIVATE-TOKEN": gitlab_token}
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return response.text
    except requests.exceptions.RequestException as e:
        print(f"Error fetching file content for {file_path} at ref {ref_sha}: {e}")
        print(f"Response Body: {e.response.text if hasattr(e.response, 'text') else 'N/A'}")
        return None

def get_git_diff_for_file(project_dir, base_sha, head_sha, file_path_to_diff):
    try:
        command = ["git", "diff", base_sha, head_sha, "--", file_path_to_diff]
        result = subprocess.run(command, cwd=project_dir, check=True, capture_output=True, text=True)
        return result.stdout
    except subprocess.CalledProcessError as e:
        print(f"Error generating git diff for {file_path_to_diff}: {e.stderr}")
        return None
    except Exception as e:
        print(f"Unexpected error in get_git_diff_for_file: {e}")
        return None

def parse_diff_lines_robust(diff_string):
    current_line_num_new = 0
    
    for line in diff_string.split('\n'):
        if line.startswith('@@'):
            try:
                match = re.search(r'\+(\d+)(,\d+)?', line)
                if match:
                    current_line_num_new = int(match.group(1))
                else:
                    current_line_num_new = 0
            except (ValueError, IndexError):
                current_line_num_new = 0
            yield (0, line, '@@')
            continue
        
        if not current_line_num_new:
            continue

        line_type = line[0] if len(line) > 0 else ' '
        content = line[1:] if len(line) > 0 else ''

        if line_type == '-':
            yield (0, content, '-')
        elif line_type == '+':
            yield (current_line_num_new, content, '+')
            current_line_num_new += 1
        else:
            yield (current_line_num_new, content, ' ')
            current_line_num_new += 1

def format_diff_for_llm(diff_string):
    formatted_lines = []
    for line_num, content, line_type in parse_diff_lines_robust(diff_string):
        if line_type == '@@':
            formatted_lines.append(content)
        elif line_type == '-':
            formatted_lines.append(f"   : -{content}")
        elif line_type in ['+', ' ']:
            formatted_lines.append(f"{str(line_num).ljust(3)}: {line_type}{content}")
    return "\n".join(formatted_lines)

def get_gemini_summary_for_mr(all_files_data, mr_title, mr_description):
    if not GEMINI_API_KEY_QA1:
        print("Error: GEMINI_API_KEY_QA1 is not set.")
        return None
        
    client = genai.Client(api_key=GEMINI_API_KEY_QA1)
    
    prompt_parts = [
        f"""
You are a staff-level software engineer and a highly skilled technical writer. 
Your task is to analyze a Merge Request and provide a concise yet detailed summary of its changes. 
You will be provided with the MR's title and description, and then details for each changed file (full content after changes, optionally full content before changes, and the numbered diff).

**Merge Request Title:** {mr_title}
**Merge Request Description:**
{mr_description}

Your summary should:
1.  **Briefly explain the purpose** of the MR based on its title, description, and changes.
2.  **Describe the key changes made** across all files. Highlight important new features, refactorings, bug fixes, or architectural shifts.
3.  **Mention any notable patterns, improvements** that span multiple files (e.g., consistent error handling, a new common utility).
4.  Be **concise**. Use bullet points. Each bullet point should have a maximum of 3 sentences. Nest bullet points to group together similar topics.
5.  Be formatted in **Markdown**.
6.  Ignore frivolous language, and focus only on the technical details.
7.  Assume the reader is a technical expert. Do not explain the changes in the code, only describe the changes.
8.  Do not attempt to evaluate the merit of the changes, or pass any good or bad judgement on the changes. Summarize the changes from a wholly objective viewpoint.
9.  **For entirely new files, simply state that the file was added and briefly describe its high-level purpose. Do not describe the internal functions or workings of the new file's code.**
10. No need to mention concerns, this should only be a summary of the actual changes in the MR.

Divide your summary into two sections:
1. Key changes, a high level summary of the most important changes. Keep the description to less than 3 sentences.
2. Notable Patterns / Improvements, a more detailed summary of the changes. Focus on only the most important changes.

--- Start of Changed Files Data ---
"""
    ]

    for file_data in all_files_data:
        prompt_parts.append(f"""
### File: {file_data['new_path']}
""")
        if file_data.get('old_file_content'):
            prompt_parts.append(f"""
Full File Content (Before Changes):
```swift
{file_data['old_file_content']}
```
""")
        
        prompt_parts.append(f"""
Full File Content (After Changes):
```swift
{file_data['full_file_content']}
```

Numbered Diff for {file_data['new_path']}:
```diff
{file_data['formatted_diff']}
```
""")
    
    prompt_parts.append("--- End of Changed Files Data ---")
    
    final_prompt = "\n".join(prompt_parts)

    if len(final_prompt) > MAX_PROMPT_CHARS:
        print(f"Warning: Total prompt size ({len(final_prompt)} chars) exceeds MAX_PROMPT_CHARS ({MAX_PROMPT_CHARS} chars).")
        print("Skipping combined summary review. This MR is too large for a single AI request.")
        return None

    try:
        response = client.models.generate_content(
            model='gemini-2.5-pro',
            contents=final_prompt
        )
        return response.text

    except Exception as e:
        print(f"Error communicating with Gemini API (combined summary review): {e}")
        return None

def post_summary_comment(comment_body, project_id, mr_iid, api_url, gitlab_token, existing_note_id=None):
    headers = {"PRIVATE-TOKEN": gitlab_token}
    data = {"body": comment_body}

    if existing_note_id:
        url = f"{api_url}/projects/{project_id}/merge_requests/{mr_iid}/notes/{existing_note_id}"
        method = requests.put
    else:
        url = f"{api_url}/projects/{project_id}/merge_requests/{mr_iid}/notes"
        method = requests.post

    try:
        response = method(url, headers=headers, data=data)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        print(f"Error posting summary comment to GitLab. Status Code: {e.response.status_code}")
        print(f"Response Body: {e.response.text if hasattr(e.response, 'text') else 'N/A'}")

if __name__ == "__main__":
    existing_summary_comment_id = get_existing_summary_comment_id(
        GITLAB_PROJECT_ID, GITLAB_MR_IID, GITLAB_API_URL, GITLAB_TOKEN
    )

    mr_data, changes, mr_title, mr_description = get_mr_details()

    if not mr_data or not changes or mr_title is None or mr_description is None:
        exit()

    files_to_review = changes

    if not files_to_review:
        exit()
    if len(files_to_review) > MAX_FILES_TO_ANALYZE:
        print(f"Skipping combined summary review due to file count: more than {MAX_FILES_TO_ANALYZE} files were changed.")
        exit()

    position_shas = {
        "base_sha": mr_data['diff_refs']['base_sha'],
        "start_sha": mr_data['diff_refs']['start_sha'],
        "head_sha": mr_data['diff_refs']['head_sha'],
    }
    
    all_files_data = []

    for file_change in files_to_review:
        file_path_for_git = file_change.get('new_path') or file_change.get('old_path')
        if not file_path_for_git:
            continue
        
        if not file_change.get('new_file') and not file_change.get('deleted_file') and not file_change.get('renamed_file') and not file_change.get('new_path') and not file_change.get('old_path'):
            continue
        
        current_file_diff = get_git_diff_for_file(
            CI_PROJECT_DIR, 
            position_shas['base_sha'], 
            position_shas['head_sha'], 
            file_path_for_git
        )

        if current_file_diff is None or not current_file_diff.strip():
            continue
        
        full_file_content = ""
        if not file_change.get('deleted_file'): 
            full_file_content = get_file_content_from_gitlab(
                GITLAB_PROJECT_ID, 
                file_change['new_path'], 
                position_shas['head_sha'], 
                GITLAB_API_URL, 
                GITLAB_TOKEN
            )
            if full_file_content is None:
                full_file_content = ""

        numbered_diff = format_diff_for_llm(current_file_diff)
        
        old_file_content = ""
        if not file_change.get('new_file', False) and file_change.get('old_path'):
            old_file_content = get_file_content_from_gitlab(
                GITLAB_PROJECT_ID, 
                file_change['old_path'], 
                position_shas['base_sha'], 
                GITLAB_API_URL, 
                GITLAB_TOKEN
            )
            if not old_file_content:
                old_file_content = ""

        all_files_data.append({
            'new_path': file_change.get('new_path', file_path_for_git),
            'old_path': file_change.get('old_path', file_path_for_git),
            'full_file_content': full_file_content,
            'old_file_content': old_file_content,
            'formatted_diff': numbered_diff
        })
    
    if not all_files_data:
        exit()

    summary_text = get_gemini_summary_for_mr(all_files_data, mr_title, mr_description)

    if summary_text:
        summary_comment = f"{BOT_COMMENT_HEADER}\n\n{summary_text}"
        post_summary_comment(summary_comment, GITLAB_PROJECT_ID, GITLAB_MR_IID, GITLAB_API_URL, GITLAB_TOKEN, existing_summary_comment_id)