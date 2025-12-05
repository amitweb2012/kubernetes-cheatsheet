# Explanation:

This YAML file defines a Pod running a MySQL database server and a ClusterIP Service to expose the database within the Kubernetes cluster.

The Pod is labeled with "app: mysql" and uses the MySQL 8.0.23 image, with environment variables set for the root password and a default database named "mydb".

The Service named "database" selects the Pod using the same label and exposes port 3306, which is the default port for MySQL.

The ClusterIP type Service makes the database accessible only within the cluster, allowing other Pods to connect to it using the Service name "database".

# Service Discovery:

The ClusterIP Service allows other Pods in the cluster to connect to the MySQL database, making it accessible for database communication within the cluster.

kubectl exec -it pod/webapp-c64f8b446-cnwtl -- sh

cd etc/
cat resolv.conf

**_outputnameserver 10.96.0.10_**
**_search default.svc.cluster.local svc.cluster.local cluster.local_**

/etc # nslookup database

**_nslookup: can't resolve '(null)': Name does not resolve_**

**_Name: database_**
**_Address 1: 10.107.108.81 database.default.svc.cluster.local_**

apk update

apk add bind-tools

apk add mysql-client

mysql -h database -u root -ppassword fleetman

**_This setup demonstrates Kubernetes Service Discovery,
where the Pod can resolve the "database" Service to connect to the MySQL database using its internal ClusterIP address._**

**_fully qualified domain name (FQDN) of the service is:
database.default.svc.cluster.local_**
