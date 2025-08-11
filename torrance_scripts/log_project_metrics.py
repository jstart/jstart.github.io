from collections import defaultdict
from pathlib import Path
from datetime import datetime

from datadog_api_client import ApiClient, Configuration
from datadog_api_client.v2.api.logs_api import LogsApi
from datadog_api_client.v2.model.content_encoding import ContentEncoding
from datadog_api_client.v2.model.http_log import HTTPLog
from datadog_api_client.v2.model.http_log_item import HTTPLogItem

import os
import re
import json

# Retrieve all .swift files from the project path
project_directory = os.environ['BITRISE_SOURCE_DIR']
all_swift_files = list(Path(project_directory).rglob("*.swift"))

# Path parts to exclude from processing. If a file path contains any of these values, processing logic
# will be skipped.
excluded_directories = ["BuildTools", "_EXTERNAL_LIBRARIES"]

# Telemetry
# ------------------
# Directory for files with event definitions
events_directory = os.path.join(project_directory, "Packages/Telemetry/Sources/Telemetry/Service/Events")
all_event_files = list(Path(events_directory).rglob("Events+*.swift"))

# Loops through all the files in the events directory and finds all the event declarations.
# Searches specifically lines containing `= Event`, splits the line into words, then finds the word after
# `let`. This means that `public static let someTelemetryEvent = Event(...` will parse into `someTelemetryEvent`
# and will be saved to the `events` list as a tuple with the filename, e.g. (Events+Auth, someTelemetryEvent)
events = []
event_definition_pattern = re.compile("= Event")

for file in all_event_files:
  for line in open(file):
    for match in re.finditer(event_definition_pattern, line):
      split = line.split(" ")
      events.append((file.stem, split[split.index("let") + 1]))

# Creates the final usage mapping dict formatted as '{Domain: Usages}', e.g. 'Events+Auth: 15'
# Domain is the file name in which the events were declared (minus the .swift), and usages is how times
# the events declared in that file were used throughout the codebase.
telemetry_usages = defaultdict(int)
# ------------------

# Tests
# -----
# Number of total test functions, e.g. lines containing `func test_` or `@Test`, grouped by {Package: Number}.
test_usages = defaultdict(int)
# Number of total test runs, e.g. number of times the tests run (some tests are run multiple times if they configured with arguments), grouped by {Package: Number}.
test_runs = defaultdict(int)
# -----

# Meta
# ----
# Number of total lines of code in the codebase.
total_lines = 0
# Number of total files in the codebase.
total_files = 0
# ----

def update_test_usages(file, test_usages_count):
    test_domain = file.parts[file.parts.index("git") + 1]

    if test_domain == "Packages":
        test_domain = file.parts[file.parts.index("Packages") + 1]

    if test_domain not in test_usages.keys():
        test_usages[test_domain] = 0

    test_usages[test_domain] += test_usages_count

def update_test_runs(file, test_runs_count):
    test_domain = file.parts[file.parts.index("git") + 1]

    if test_domain == "Packages":
        test_domain = file.parts[file.parts.index("Packages") + 1]

    if test_domain not in test_runs.keys():
        test_runs[test_domain] = 0

    test_runs[test_domain] += test_runs_count

# Main loop through all .swift files
for file in all_swift_files:
  print(file)

  # If the file path has any components within the excluded directories, ignore.
  if bool(set(file.parts) & set(excluded_directories)):
    continue

  # Total number of files
  total_files += 1

  for line in open(file):

    # Total number of lines
    if line.isspace() or line == "":
      total_lines += 1

    # Tests
    # -----
    # Retrieves the test domain from the file path, and counts the number of usages of `func test_` (XCTest framework) and `@Test func` (Testing framework).
    # within the files in that domain.
    test_usage_pattern = re.compile("(func test|@Test func).+\(.*?\)")

    if re.search(test_usage_pattern, line):
      update_test_usages(file, 1)
      update_test_runs(file, 1)

    # -----

    # Telemetry
    # ---------
    # Excludes files in the Telemetry package from being read as usages
    if "Packages/Telemetry" not in str(file):

      # Loops through all the event names, and attempts to find lines of code containing `Telemetry.*someTelemetryEvent`.
      # Counts all the usages and associates them with the file name in which the event was declared.
      for event in events:
        event_usage_pattern = re.compile(f"Telemetry\\..+{event[1]}")

        if re.search(event_usage_pattern, line):
          telemetry_usages[event[0]] += 1
    # ---------
    # Add more metrics here

  # Counts the number of usages arguments in `@Test\(arguments: []` as each argument is a separate test run. Since arguments are usually formatted to occur over several lines, the entire file needs to be read to extract the arguments.
  text_file = open(file, 'r')
  file_text = text_file.read()
  text_file.close()
  test_usage_pattern_with_arguments = re.compile(r'@Test\(arguments: \[.*?\]\)', re.DOTALL)
  for match in re.finditer(test_usage_pattern_with_arguments, file_text):
    if match.group(0):
    # Due to the variety of ways arguments can be  formatted, we won't catch every type of argument with this method. This means the number of test runs is undercounted but at least we'll catch the majority of test runs.
      pattern = re.compile(r'\[(.*?)\]', re.DOTALL) # Get the array content inside the brackets
      result = re.search(pattern, match.group(0))
      if result:
        clean_content = result.group(1).strip()
        pattern = re.compile(r',\s*(?![^()]*\))', re.DOTALL) # Split the array content by comma, ignoring commas inside brackets and parentheses
        items = re.split(pattern, clean_content)
        update_test_usages(file, 1) # Increment the number of test functions by 1
        update_test_runs(file, len(items)) # Increment the number of test runs by the number of arguments

payload = {
  "message": "project_metrics_payload",
  "telemetry": {
    "total_event_domains": len(telemetry_usages.keys()),
    "total_event_definitions": len(events),
    "total_event_usages": sum(telemetry_usages.values()),
    "usage_by_domain": telemetry_usages,
  },
  "tests": {
    "total_tests": sum(test_usages.values()),
    "total_test_runs": sum(test_runs.values()),
    "tests_by_domain": test_usages,
    "test_runs_by_domain": test_runs,
  },
  "total_lines": total_lines,
  "total_files": total_files,
}

body = HTTPLog(
  [
    HTTPLogItem(
      ddsource="ios",
      ddtags="env:production",
      message=json.dumps(payload),
      service="maven-clinic-ios",
    ),
  ]
)

configuration = Configuration()
configuration.api_key["apiKeyAuth"] = os.environ['DATADOG_API_KEY']
configuration.server_variables["site"] = "datadoghq.com"

with ApiClient(configuration) as api_client:
  api_instance = LogsApi(api_client)
  response = api_instance.submit_log(body=body)
  print(response)
