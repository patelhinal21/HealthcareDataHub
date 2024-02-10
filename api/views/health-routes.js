
const express = require('express');
const router = express.Router();
const healthPlanController = require('../controllers/health-controller.js');

router.get('/allplans',healthPlanController.getAllPlans)
router.get('/:id', healthPlanController.getPlanById);
router.post('/store', healthPlanController.storeData);
router.delete('/:id', healthPlanController.deleteStore);

module.exports = router;
