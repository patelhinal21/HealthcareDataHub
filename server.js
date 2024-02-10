const express = require('express');
const app = express();
const healthPlanRoutes = require('./api/views/health-routes.js'); 

app.use(express.json()); 


app.use('/api/healthplans', healthPlanRoutes);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server listening on port ${port}`));
