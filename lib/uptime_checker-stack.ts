import { Stack, StackProps, Duration } from 'aws-cdk-lib';
import {
  aws_sns as sns,
  aws_lambda_destinations as destinations,
  aws_lambda as lambda,
  aws_events as events,
  aws_events_targets as targets
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

const functionCode = `#Check URL uptime, return success if available, false and notify SNS if not
import urllib.request as requests
from os import environ

def handler(event,context):
  response = requests.urlopen(environ['URL'])
  return { 
    "statusCode": response.status, "body": { "status": response.status, "URL": environ['URL'] },
    "headers": { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" }
  }
`

export class UptimeCheckerStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    if (this.node.tryGetContext('URL') == "" || this.node.tryGetContext('topic') == "") { throw ("URL and topic context variables required") }

    const topicArn = this.node.tryGetContext('topic')
    const URL = this.node.tryGetContext('URL')

    const topic = sns.Topic.fromTopicArn(this, "topic", topicArn)

    const requestFunction = new lambda.Function(this, 'Singleton', {
      functionName: "uptimeChecker",
      code: lambda.Code.fromInline(functionCode),
      environment: { URL },
      handler: 'index.handler',
      timeout: Duration.seconds(30),
      runtime: lambda.Runtime.PYTHON_3_9,
      onFailure: new destinations.SnsDestination(topic)
    });

    // Run every day at 4am UTC https://docs.aws.amazon.com/lambda/latest/dg/tutorial-scheduled-events-schedule-expressions.html
    const rule = new events.Rule(this, 'Rule', { schedule: events.Schedule.expression('cron(0 4 ? * * *)') });

    rule.addTarget(new targets.LambdaFunction(requestFunction));
  }
}
