import { Client } from "@elastic/elasticsearch";
import { readFileSync } from "fs";

const elasticsearchClient = new Client({
  node: "https://localhost:9200/",
   auth: {
     username: "elastic",
     password: "RsaCh-zl_sUTajGiza5Y", //change
   },
  tls: {
     ca: readFileSync("/Users/hinalpatel/http_ca.crt"), //change
    rejectUnauthorized: false,
   },
});

 let info = await elasticsearchClient.info();
 console.log(info);
export default elasticsearchClient;
