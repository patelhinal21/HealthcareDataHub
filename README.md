# adv-big-data-indexing

# redis

To start redis server, run the command redis-stack-server
To enter redis-cli, enter command redis-cli

# to start elasticsearch

1. create a network - docker network create elastic
2. pull docker image - docker pull docker.elastic.co/elasticsearch/elasticsearch:8.13.2
3. run elasticsearch container - docker run --name es01 --net elastic -p 9200:9200 -it -m 1GB docker.elastic.co/elasticsearch/elasticsearch:8.13.2. This command generates elastic user passowrd and enrollment token for kibana
4. regenerate password using - docker exec -it es01 /usr/share/elasticsearch/bin/elasticsearch-reset-password -u elastic
   docker exec -it es01 /usr/share/elasticsearch/bin/elasticsearch-create-enrollment-token -s kibana
5. store elastic password as a variable in the shell - export ELASTIC_PASSWORD="your_password"
6. docker cp es01:/usr/share/elasticsearch/config/certs/http_ca.crt . - Copy the http_ca.crt SSL certificate from the container to your local machine.
7. curl --cacert http_ca.crt -u elastic:$ELASTIC_PASSWORD https://localhost:9200 - Make a REST API call to Elasticsearch to ensure the Elasticsearch container is running.

# to start kibana

1. pull docker image - docker pull docker.elastic.co/kibana/kibana:8.13.2
2. start a kibana container - docker run --name kib01 --net elastic -p 5601:5601 docker.elastic.co/kibana/kibana:8.13.2

# to start rabbitmq

1. start rabbitmq - docker run -it --rm --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3.13-management
