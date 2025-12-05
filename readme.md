# Docker Architecture

The Docker architecture consists of several components that work together to provide a platform for building, shipping, and running containerized applications.

**_Docker Daemon:_** The Docker daemon is a background service that
runs on the host machine and manages Docker objects such as images, containers, networks, and volumes.

**_Docker Client:_** The Docker client is a command-line tool that allows users to interact with the Docker daemon. It sends commands to the Docker daemon using the Docker API, which is exposed over a network socket or a RESTful API.

**_Docker Images:_** A Docker image is a read-only template that contains instructions for creating a Docker container. It includes an application and all its dependencies, such as libraries, frameworks, and runtime environments.

**_Docker Containers:_** A Docker container is a runnable instance of a Docker image. It encapsulates an application and its dependencies in a lightweight, portable, and isolated environment. Multiple containers can run on a single host, each with its own file system, network interface, and process namespace.

**_Docker Registries:_** A Docker registry is a repository for Docker images. It is a server-side application that stores and distributes Docker images. Docker Hub is the default public registry for Docker images, but users can also create their own private registries for storing and sharing Docker images within their organization.

**_Docker Network:_** A Docker network is a virtual network that allows containers to communicate with each other and with the outside world. Docker provides several types of network drivers, including bridge, host, overlay, and others.

**_Docker Volumes:_** A Docker volume is a persistent data storage mechanism for containers. It allows data to be stored separately from the container file system, making it easier to manage and back up data.

# Kubernetes Architecture

Kubernetes is a distributed system that manages containerized applications across a cluster of nodes. It has a modular architecture that consists of several components that work together to provide a reliable and scalable platform for running and managing containerized workloads.

**_Control Plane:_** The master node is the control plane that manages the overall state of the Kubernetes cluster. It runs several components, including the API server, etcd, controller manager, and scheduler.

**_Nodes:_** Nodes are worker machines that run containerized applications. Each node has a container runtime, such as Docker or CRI-O, and a kubelet, which communicates with the master node to receive instructions on which containers to run.

**_API Server:_** The API server provides a REST interface for managing the Kubernetes cluster. It accepts requests from clients and other components, validates them, and updates the cluster state in etcd.

**_etcd:_** etcd is a distributed key-value store that stores the configuration data and state of the Kubernetes cluster. It provides a reliable and consistent data store that can be accessed by all the components.

**_Controller Manager:_** The controller manager runs several controllers that monitor the state of the cluster and take actions to ensure that the desired state is maintained. For example, the replication controller ensures that a specified number of pod replicas are running at all times.

**_Scheduler:_** The scheduler assigns workloads to nodes based on resource availability and other constraints. It takes into account factors such as pod resource requirements, node resource capacity, and affinity/anti-affinity rules.

**_kubelet:_** The kubelet runs on each node and communicates with the API server to receive instructions on which containers to run. It is responsible for ensuring that the containers are running and healthy.

**_Container Runtime:_** The container runtime is responsible for running the containers on each node. It is usually Docker or CRI-O, but other runtimes can be used.

**_kube-proxy:_** The kube-proxy is responsible for managing network routing and load balancing for services in the Kubernetes cluster. It runs on each node and maintains a network proxy that reflects the current state of the cluster’s services. It also handles service discovery and implements the Kubernetes Service abstraction, which provides a stable IP address and DNS name for a set of pods.

## The Differences between a Container & Pod

A container is a lightweight, standalone executable package of software that includes everything needed to run an application, including the code, runtime, system tools, libraries, and settings. Containers are isolated from the host system and other containers, making them portable and easy to deploy across different environments. A pod, on the other hand, is a basic unit of deployment in Kubernetes, an open-source container orchestration platform. A pod can contain one or more containers, and it represents a logical host for those containers. All containers in a pod share the same network namespace, and they can communicate with each other using localhost. They can also share the same storage volumes.

In summary, a container is a self-contained runtime environment for an application, while a pod is a deployment unit that can contain one or more containers and provides a shared network and storage environment for them.
