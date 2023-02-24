import { Stack, StackProps, Duration } from 'aws-cdk-lib';
import {
  aws_sns as sns,
  aws_lambda_destinations as destinations,
  aws_lambda as lambda,
  aws_events as events,
  aws_events_targets as targets
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

const requestURLs = [
  "https://mastersautomation.tech/",
  "https://httpstat.us/400",
  "https://httpstat.us/500",
  "https://httpstat.us/200"
]

const functionCode = `#Check URL uptime, return success if available, false and notify SNS if not
import urllib.request as requests

def handler(event,context):
  response = requests.urlopen(event['URL'])
  print(response)
  return { 
    "statusCode": response.status, "body": { "status": response.status, "URL": event['URL'] },
    "headers": { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" }
  }
`

export class UptimeCheckerStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    if (this.node.tryGetContext('topic') == "") { throw ("Topic context variable required") }
    const topic = sns.Topic.fromTopicArn(this, "topic", this.node.tryGetContext('topic'))

    const requestFunction = new lambda.Function(this, `UptimeRequest`, {
      functionName: `uptimeChecker`,
      code: lambda.Code.fromInline(functionCode),
      handler: 'index.handler',
      timeout: Duration.seconds(30),
      runtime: lambda.Runtime.PYTHON_3_9,
      onFailure: new destinations.SnsDestination(topic)
    })

    // Run every day at 4am UTC https://docs.aws.amazon.com/lambda/latest/dg/tutorial-scheduled-events-schedule-expressions.html
    const rules = [
      new events.Rule(this, 'Rule4', { schedule: events.Schedule.expression('cron(0 4 ? * * *)') }),
      new events.Rule(this, 'RuleN', { schedule: events.Schedule.expression('cron(0 12 ? * * *)') }),
      new events.Rule(this, 'Rule8', { schedule: events.Schedule.expression('cron(0 20 ? * * *)') })
    ]

    rules.map(r => {
      requestURLs.map(URL => {
        r.addTarget(new targets.LambdaFunction(requestFunction, { event: events.RuleTargetInput.fromObject({ URL }) }))
      })
    })

  }
}