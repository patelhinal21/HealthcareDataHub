
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../controllers/health-controller.js');
const healthPlanController = require('../controllers/health-controller.js');


// router.get('/allplans',healthPlanController.getAllPlans)
// router.get('/:id', healthPlanController.getPlanById);
// router.post('/store', healthPlanController.storeData);
// router.delete('/:id', healthPlanController.deleteStore);
// router.put('/:id', healthPlanController.updatePlan);
// router.patch('/:id', healthPlanController.patchPlan);

router.get('/allplans', verifyToken, healthPlanController.getAllPlans);
router.get('/:id', verifyToken, healthPlanController.getPlanById);
router.post('/store', verifyToken, healthPlanController.storeData);
router.delete('/:id', verifyToken, healthPlanController.deleteStore);
router.put('/:id', verifyToken, healthPlanController.updatePlan); 
router.patch('/:id', verifyToken, healthPlanController.patchPlan); 
module.exports = router;
