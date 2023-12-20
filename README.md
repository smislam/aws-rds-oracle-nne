# An Example of Encryption in Transit to AWS RDS Oracle database Using Oracle Native Network Encryption from Spring Boot application using AWS CDK

This example demonstrates how encrypted connections can be made from from a Spring Boot application to AWS RDS Oracle database using JDBC.

This project is deployed using AWS CDK in TypeScript.

## What does it build?
* Creates a VPC with Endpoints for Database.  This is required to route database traffic within aws network.
* Creates an AWS RDS Oracle Database with NNE enabled
* Creates a Spring Boot application that connects to that Database
* Dockerizes the application
* Deployes the containerized application to ECS Cluster
* Exposes the API endpoints using AWS ALB

## Steps to run and test
* Deploy the CDK code. Wait for the deploy to finish.  It will print out the Alb endpoint for you to hit.
  * ![image](test-nne-encryption-rds.PNG "Verify NNE connection to Database ")

## NNE Considerations
* Details about Oracle NNE. [See AWS Docs](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Oracle.Concepts.NNE.html).
* You must upgrade to latest 23 version of JDBC drivers for NNE to disable weak Cryptos. [See Oracle Docs](https://docs.oracle.com/en/database/oracle/oracle-database/19/jajdb/oracle/jdbc/OracleConnection.html#CONNECTION_PROPERTY_THIN_NET_ALLOW_WEAK_CRYPTO)
* You can find most of the NNE configuration properties on Oracle's documentation.  [Oracle NNE Properties](https://docs.oracle.com/en/database/oracle/oracle-database/19/dbseg/configuring-network-data-encryption-and-integrity.html#GUID-7F12066A-2BA1-476C-809B-BB95A3F727CF)
* Setting the JDBC connect parameters to encryption required with matched types will enforce the client to use encrypted connection
* All our connections from our service to database is using Private Endpoints.

