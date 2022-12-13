import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as eks from "aws-cdk-lib/aws-eks";
import * as ec2 from "aws-cdk-lib/aws-ec2";

export class NnKubeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const kubeAdmin = iam.User.fromUserName(this, "KubeAdmin", "KrunaShah");

    const clusterAdmin = new iam.Role(this, "ClusterAdminRole", {
      assumedBy: new iam.AccountRootPrincipal(),
    });

    const cluster = new eks.Cluster(this, "nn-kube-cluster", {
      version: eks.KubernetesVersion.V1_24,
      defaultCapacity: 0,
      mastersRole: clusterAdmin,
    });

    cluster.awsAuth.addUserMapping(kubeAdmin, { groups: ["system:masters"] });

    cluster.addNodegroupCapacity("nn-kube-node-group", {
      instanceTypes: [
        ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
      ],
      desiredSize: 2,
      diskSize: 20,
      maxSize: 4,
      amiType: eks.NodegroupAmiType.AL2_X86_64,
    });

    const appLabel = { app: "nn-kube" };

    const deployment = {
      apiVersion: "apps/v1",
      kind: "Deployment",
      metadata: { name: "nn-kube" },
      spec: {
        replicas: 2,
        selector: { matchLabels: appLabel },
        template: {
          metadata: { labels: appLabel },
          spec: {
            containers: [
              {
                name: "noticeninja-auth",
                image:
                  "291526921916.dkr.ecr.us-west-1.amazonaws.com/noticeninja-auth:latest",
                ports: [{ containerPort: 3001 }],
              },
            ],
          },
        },
      },
    };

    const service = {
      apiVersion: "v1",
      kind: "Service",
      metadata: { name: "nn-kube" },
      spec: {
        type: "LoadBalancer",
        ports: [{ port: 80, targetPort: 3001 }],
        selector: appLabel,
      },
    };

    cluster.addManifest("nn-kube", service, deployment);
  }
}
