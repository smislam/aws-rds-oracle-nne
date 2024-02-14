import * as cdk from 'aws-cdk-lib';
import { InstanceClass, InstanceSize, InstanceType, Peer, Port, InterfaceVpcEndpointAwsService, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Cluster, ContainerImage, FargateService, FargateTaskDefinition, LogDrivers, Secret as escSecret } from 'aws-cdk-lib/aws-ecs';
import { ApplicationLoadBalancer, ApplicationProtocol } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Credentials, DatabaseInstance, DatabaseInstanceEngine, LicenseModel, OptionGroup, OracleEngineVersion } from 'aws-cdk-lib/aws-rds';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export class AwsRdsOracleNneStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const databaseName = 'demodb';
    const username = 'demouser';
    
    const vpc = new Vpc(this, 'app-vpc', {
      maxAzs: 2,
      natGateways: 1
    });
    
    const vpces = [
      InterfaceVpcEndpointAwsService.ECR,
      InterfaceVpcEndpointAwsService.ECR_DOCKER,
      InterfaceVpcEndpointAwsService.KMS,
      InterfaceVpcEndpointAwsService.STS,
      InterfaceVpcEndpointAwsService.SSM,
      InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      InterfaceVpcEndpointAwsService.CLOUDTRAIL,
      InterfaceVpcEndpointAwsService.EVENTBRIDGE,
      InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
      InterfaceVpcEndpointAwsService.AUTOSCALING,
      InterfaceVpcEndpointAwsService.RDS
    ];

    vpces.forEach(vpce => vpc.addInterfaceEndpoint(
      vpce.shortName, {
        service: vpce,
        privateDnsEnabled: true
      }
    ));

    const secret = new Secret(this, 'oracleDbSecret', {
      secretName: databaseName,
      description: `${databaseName} Database Secret`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username
        }),
        generateStringKey: 'password',
        excludeCharacters: " %+~`#$&*()|[]{}:;<>?!'/@\"\\",
        passwordLength: 28,
      }
    });

    const engine = DatabaseInstanceEngine.oracleSe2({version: OracleEngineVersion.VER_19_0_0_0_2023_10_R1});
    
    // Oracle NNE Specific configurations
    const optionGroup = new OptionGroup(this, 'oracle-nne-og', {
      engine,
      description: 'Oracle NNE Options Setup',
      configurations: [{
        name: 'NATIVE_NETWORK_ENCRYPTION',
        settings: {
          'SQLNET.ALLOW_WEAK_CRYPTO': 'FALSE',
          'SQLNET.CRYPTO_CHECKSUM_SERVER': 'REQUIRED',
          'SQLNET.ENCRYPTION_TYPES_SERVER': 'AES256',
          'SQLNET.ENCRYPTION_SERVER': 'REQUIRED',
        }
      }]
    });
    
    optionGroup.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);
    
    const dbInstance = new DatabaseInstance(this, 'oracle-instance', {
      vpc,
      engine,
      instanceType: InstanceType.of(InstanceClass.BURSTABLE3, InstanceSize.LARGE),
      licenseModel: LicenseModel.LICENSE_INCLUDED,
      databaseName,
      instanceIdentifier: databaseName,
      credentials: Credentials.fromSecret(secret),
      maxAllocatedStorage: 200,
      storageEncrypted: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      backupRetention: cdk.Duration.millis(0),
      optionGroup,
      caCertificate: CaCertificate.RDS_CA_RDS4096_G1
    });
    
    dbInstance.node.addDependency(optionGroup);

    
    const cluster = new Cluster(this, 'Cluster', {vpc});
    cluster.node.addDependency(dbInstance);

    const taskDefinition = new FargateTaskDefinition(this, 'my-task-def', {});

    const container = taskDefinition.addContainer('my-app-container', {
      image: ContainerImage.fromAsset('./rdstls'),
      memoryLimitMiB: 256,
      cpu: 256,
      portMappings: [{
        containerPort: 8080,
        hostPort: 8080
      }],
      logging: LogDrivers.awsLogs({streamPrefix: 'my-rds-oracle-nne-service'}),
      secrets: {
        DB_HOST: escSecret.fromSecretsManager(secret, 'host'),
        DB_PORT: escSecret.fromSecretsManager(secret, 'port'),
        DB_NAME: escSecret.fromSecretsManager(secret, 'dbname'),
        DB_USERNAME: escSecret.fromSecretsManager(secret, 'username'),
        DB_PASSWORD: escSecret.fromSecretsManager(secret, 'password')
      }
    });

    const ecsService = new FargateService(this, 'nne-service', {
      cluster,
      taskDefinition,
      desiredCount: 1
    });
    
    dbInstance.connections.allowDefaultPortFrom(ecsService);

    const alb = new ApplicationLoadBalancer(this, 'alb', {
      vpc,
      internetFacing: true
    });

    const listener = alb.addListener('app-listener', {
      port: 80
    });

    listener.addTargets('alb-target', {
      port: 80,
      targets: [ecsService],
      protocol: ApplicationProtocol.HTTP,
      healthCheck: {
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 10,
        timeout: cdk.Duration.seconds(10),
        interval: cdk.Duration.seconds(20)
      }
    });

    new cdk.CfnOutput(this, 'alb-url', {
      value: alb.loadBalancerDnsName,
      exportName: 'rds-oracle-nne-stack-loadBalancerDnsName'
    });
        
  }
}
