# SevaFix AWS bootstrap

These files create the deployment role used by the local `sevafix-deploy` AWS CLI profile.

- The root login is used once for bootstrap only.
- IAM user `sevafix-deployer` has console access with MFA, no access keys, and browser-based temporary local-development credentials.
- The human login uses temporary browser credentials in profile `sevafix-user`.
- Profile `sevafix-deploy` sources `sevafix-user` and assumes `sevafix-deployment-role`.
- The role has AWS managed `PowerUserAccess` for application services.
- IAM mutation and `PassRole` are separately limited to roles named `sevafix-*` and approved AWS services.
- The bootstrap/root profile must not be used for application deployment.

Revisit the policy after the CloudFormation templates stabilize and replace `PowerUserAccess` with an action/resource policy generated from the deployed architecture.
