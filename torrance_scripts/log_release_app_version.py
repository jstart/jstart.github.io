from datadog_api_client import ApiClient, Configuration
from datadog_api_client.v1.api.events_api import EventsApi
from datadog_api_client.v1.model.event_create_request import EventCreateRequest
import os

version = os.environ['RM_RELEASE_VERSION']

body = EventCreateRequest(
	title="Maven iOS App Version {version} Released".format(version=version),
	text="Rollout for Maven iOS version {version} has been initiated.".format(version=version),
	tags=[
		"source:bitrise",
		"project:ios",
		"service:maven-clinic-ios",
		"environment:production"
	],
)

configuration = Configuration()
configuration.api_key["apiKeyAuth"] = os.environ['DATADOG_API_KEY']
configuration.server_variables["site"] = "datadoghq.com"

with ApiClient(configuration) as api_client:
  api_instance = EventsApi(api_client)
  response = api_instance.create_event(body=body)
  print(response)
