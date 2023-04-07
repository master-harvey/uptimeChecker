#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { UptimeCheckerStack } from '../lib/uptime_checker-stack';

const app = new cdk.App();
new UptimeCheckerStack(app, 'UptimeCheckerStack', {});