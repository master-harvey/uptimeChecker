import { Stack, StackProps, Duration } from 'aws-cdk-lib';
import {
  aws_sns as sns,
  aws_lambda_destinations as destinations,
  aws_lambda as lambda,
  aws_events as events,
  aws_events_targets as targets
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

const checkURLs = [
  "https://google.com/",
  "https://bing.com/"
]

//takes an hour of the 24 hour day or a cron string like: cron(0 12 ? * * *)
const times = ["cron(0 4 ? * * *)", 12, "cron(0 20 ? * * *)"]

const functionCode = `#Check URL uptime, return success if available, false and notify SNS if not
import urllib.request.urlopen as urlopen

def handler(event,context):
  try:
    response = urlopen(event['URL'])
    print(response)
    return { "statusCode": response.status, "body": { "status": response.status, "URL": event['URL'] } }
  except:
    raise(Exception("Error connecting to "+event['URL']))
`

export class UptimeCheckerStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    if (this.node.tryGetContext('topic') == "") { throw ("Topic context variable required") }
    const topic = sns.Topic.fromTopicArn(this, "topic", this.node.tryGetContext('topic'))

    const requestFunction = new lambda.Function(this, `UptimeRequest`, {
      functionName: `CheckUptime`,
      code: lambda.Code.fromInline(functionCode),
      handler: 'index.handler',
      timeout: Duration.seconds(30),
      runtime: lambda.Runtime.PYTHON_3_9,
      onFailure: new destinations.SnsDestination(topic)
    })

    // Run every day when specified UTC https://docs.aws.amazon.com/lambda/latest/dg/tutorial-scheduled-events-schedule-expressions.html
    const rules = times.map((time, i) => {
      return new events.Rule(this, `Rule${i}`, { schedule: events.Schedule.expression((typeof time == "number") ? `cron(0 ${time} ? * * *)` : time) })
    })

    rules.map(r => {
      checkURLs.map(URL => {
        r.addTarget(new targets.LambdaFunction(requestFunction, { event: events.RuleTargetInput.fromObject({ URL }) }))
      })
    })

  }
}