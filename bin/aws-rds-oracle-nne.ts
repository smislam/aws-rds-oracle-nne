#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AwsRdsOracleNneStack } from '../lib/aws-rds-oracle-nne-stack';

const app = new cdk.App();
new AwsRdsOracleNneStack(app, 'AwsRdsOracleNneStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
});