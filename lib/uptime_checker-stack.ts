import { Stack, StackProps, Duration } from 'aws-cdk-lib';
import {
  aws_sns as sns,
  aws_sns_subscriptions as subscripitons,
  aws_lambda as lambda,
  aws_events as events,
  aws_events_targets as targets
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class UptimeCheckerStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    if (this.node.tryGetContext('timeout') == "" || this.node.tryGetContext('URL') == "" || this.node.tryGetContext('topic') == "") { throw ("URL, topic, and timeout context variables required") }

    const timeout = Number(this.node.tryGetContext('timeout'))
    const topicArn = this.node.tryGetContext('topic')
    const URL = this.node.tryGetContext('URL')

    const requestFunction = new lambda.Function(this, 'Singleton', {
      code: lambda.Code.fromInline(`#Check URL uptime, return success if available, false and notify SNS if not
      from botocore.vendored import requests
      response = requests.get("https://httpbin.org/get", timeout=${timeout})
      return { 
        "statusCode": response.status_code, "body": { "status": response.status_code },
        "headers": { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" }
      }
      `),
      handler: 'index.function_name',
      timeout: Duration.seconds(timeout),
      runtime: lambda.Runtime.PYTHON_3_9,
    });

    const topic = sns.Topic.fromTopicArn(this, "topic", topicArn)
    topic.addSubscription(new subscripitons.LambdaSubscription(requestFunction, {
      filterPolicy: {
        status: sns.SubscriptionFilter.numericFilter({lessThan: 200, greaterThan: 300}),
      }
    }))

    // Run every day at 4am UTC https://docs.aws.amazon.com/lambda/latest/dg/tutorial-scheduled-events-schedule-expressions.html
    const rule = new events.Rule(this, 'Rule', { schedule: events.Schedule.expression('cron(0 4 ? * * *)') });

    rule.addTarget(new targets.LambdaFunction(requestFunction));
  }
}
