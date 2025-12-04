**_ Commands _**

kubectl apply -f namespace.yaml
kubectl apply -f apache.yaml
kubectl apply -f nginx.yaml
kubectl apply -f ingress.yaml
kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 8080:80
