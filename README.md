# Simple serverless Uptime Checker

Lambda + SNS to check and notify of a loss in URL uptime.

During deployment you must supply an SNS topic ARN via the topic context variable:

`cdk deploy -c topic=<your topic ARN>`

## URLs and Times

Supply URLs in the request URL's variable array and times in the times array. Times can be either an integer < 25 in order to specify an hour of the day to check or a cron string directly for more finite control eg: cron(0 12 ? * * *)
