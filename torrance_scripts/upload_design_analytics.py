from collections import defaultdict
from pathlib import Path
from datetime import datetime

from datadog_api_client import ApiClient, Configuration
from datadog_api_client.v2.api.metrics_api import MetricsApi
from datadog_api_client.v2.model.metric_intake_type import MetricIntakeType
from datadog_api_client.v2.model.metric_payload import MetricPayload
from datadog_api_client.v2.model.metric_point import MetricPoint
from datadog_api_client.v2.model.metric_resource import MetricResource
from datadog_api_client.v2.model.metric_series import MetricSeries

import os
import re

designSystemFilesPath = os.path.join(os.environ['BITRISE_SOURCE_DIR'], "Packages/DesignSystem/")
codeFilesPath = os.environ['BITRISE_SOURCE_DIR']
excludedDirectory = os.path.join(os.environ['BITRISE_SOURCE_DIR'], "Maven/_CORE/_UTILITIES/_PLAYBOOK")

designSystemFiles = list(Path(designSystemFilesPath).rglob("*.swift"))
codeFiles = list(Path(codeFilesPath).rglob("*.swift"))
excludedFiles = list(Path(excludedDirectory).rglob("*.swift"))

pattern = re.compile(": View {")
designSystemObjects = []
for file in designSystemFiles:
    for i, line in enumerate(open(file)):
        for match in re.finditer(pattern, line):
            designSystemObjects.append(file.stem)

for file in excludedFiles:
    codeFiles.remove(file)

for file in designSystemFiles:
    codeFiles.remove(file)

usageResults = defaultdict(list)
for dso in designSystemObjects:
    functions_pattern = '|'.join(re.escape(func) for func in [dso])

    pattern = fr'\s+{dso}\('

    usageResults[dso] = list()
    for file in codeFiles:
        for i, line in enumerate(open(file)):
            if re.search(pattern, line):
                usageResults[dso].append(str(file) + ":" + str(i) + " == " + line)

usageCounter = defaultdict(int)
series = []
total = 0
for key in usageResults.keys():
    count = len(usageResults[key])
    total += count
    usageCounter[key] = count

usageCounter["total"] = total

series = [MetricSeries(
            metric="designSystemUsage.iOS."+key,
            type=MetricIntakeType.UNSPECIFIED,
            points=[
                MetricPoint(
                    timestamp=int(datetime.now().timestamp()),
                    value=count,
                ),
            ],
            resources=[
                MetricResource(
                    name="dummyhost",
                    type="host",
                ),
            ],
        ) for key, count in usageCounter.items()]

body = MetricPayload(
    series=series,
)

configuration = Configuration()
configuration.api_key["apiKeyAuth"] = os.environ['DATADOG_API_KEY']
configuration.server_variables["site"] = "datadoghq.com"

with ApiClient(configuration) as api_client:
    api_instance = MetricsApi(api_client)
    response = api_instance.submit_metrics(body=body)
