# Running with Docker and Kubernetes

## Docker
Start Docker Desktop, then from the project folder:

    docker compose up --build        # http://localhost:8081   (Ctrl+C to stop)

## Kubernetes on this computer (Docker Desktop)
Docker Desktop -> Settings -> Kubernetes -> Enable Kubernetes. Then:

    docker build -t gigf-web:1.0 .
    cp k8s/secrets.env.example k8s/secrets.env       # fill it in
    kubectl create secret generic gigf-secrets --from-env-file=k8s/secrets.env
    kubectl apply -k k8s
    kubectl rollout status deployment/gigf-web
    kubectl port-forward service/gigf-web 8081:80    # http://localhost:8081

If your cluster does not see the local image (e.g. a "kind" based cluster), push it to a registry and change `image:` in deployment.yaml.

Useful: `kubectl get pods`, `kubectl logs -l app=gigf-web`, `kubectl delete -k k8s` (removes everything).

## Going public
1. Push the image to a registry and set it in `deployment.yaml`.
2. Install an NGINX ingress controller and cert-manager, set your domain in `ingress.yaml`, then `kubectl apply -f k8s/ingress.yaml`.
3. Add your domain to Supabase (URL configuration) and Google (authorised origins).

## Notes
- AI rate limits and the daily cap are counted per pod, so with N pods the totals are N times higher.
- Autoscaling needs the metrics-server add-on.
- Accounts, events and news live in Supabase; the pods keep no data, so they can be added or removed freely.
