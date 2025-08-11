from collections import defaultdict
from datetime import datetime

from datadog_api_client import ApiClient, Configuration
from datadog_api_client.v2.api.metrics_api import MetricsApi
from datadog_api_client.v2.model.metric_intake_type import MetricIntakeType
from datadog_api_client.v2.model.metric_payload import MetricPayload
from datadog_api_client.v2.model.metric_point import MetricPoint
from datadog_api_client.v2.model.metric_resource import MetricResource
from datadog_api_client.v2.model.metric_series import MetricSeries

import json
import os

currentScheme = os.environ['BITRISE_SCHEME']
currentWorkflow = os.environ['BITRISE_TRIGGERED_WORKFLOW_TITLE']
currentBranch = os.environ['BITRISE_GIT_BRANCH']
currentCommit = os.environ['BITRISE_GIT_COMMIT']
buildNumber = os.environ['BITRISE_BUILD_NUMBER']
buildSlug = os.environ['BITRISE_BUILD_SLUG']
triggerMethod = os.environ['BITRISE_TRIGGER_METHOD']
triggeredBy = os.environ['BITRISE_TRIGGER_BY']
appTitle = os.environ['BITRISE_APP_TITLE']

customTags = [
    f"workflow_name:{currentWorkflow}",
    f"branch:{currentBranch}",
    f"commit:{currentCommit}",
    f"build_number:{buildNumber}",
    f"build_slug:{buildSlug}",
    f"trigger_method:{triggerMethod}",
    f"triggered_by:{triggeredBy}",
    f"app_title:{appTitle}",
    f"scheme:{currentScheme}",
]

try:
    releaseTag = os.environ['BITRISE_GIT_TAG']
    customTags.append(f"release_tag:{releaseTag}")
except KeyError:
    print("Release tag not found.")

# Using xcresultparser in the previous step, the readout of total coverage is a large string containing extra characters.
# Splits of the larger readout to retrieve the actual "total coverage" as a single percentage.
totalCoverageReadout = os.environ['TOTAL_COVERAGE_READOUT']
a, totalCoverageSplit1 = totalCoverageReadout.split(': ', 1)
totalCoveragePercentage, b = totalCoverageSplit1.split('%', 1)

with open(f"{currentScheme}-coverage-report.json", "r") as file:
  data = file.read()

targetCoverage = json.loads(data)

coverageDict = defaultdict(float)

coverageDict["TotalCoverage"] = float(totalCoveragePercentage)

for item in targetCoverage:
    target = item.get("name")
    coverage = item.get("lineCoverage")
    coverageDict[target] = coverage

series = [MetricSeries(
            metric=f"mvn.codeCoverage.iOS.{currentScheme}." + target,
            type=MetricIntakeType.UNSPECIFIED,
            points=[
                MetricPoint(
                    timestamp=int(datetime.now().timestamp()),
                    value=coverage,
                ),
            ],
            tags=customTags,
        ) for target, coverage in coverageDict.items()]

body = MetricPayload(
    series=series,
)

configuration = Configuration()
configuration.api_key["apiKeyAuth"] = os.environ['DATADOG_API_KEY']
configuration.server_variables["site"] = "datadoghq.com"

with ApiClient(configuration) as api_client:
    api_instance = MetricsApi(api_client)
    response = api_instance.submit_metrics(body=body)
    print(response)
