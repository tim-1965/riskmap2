const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Country schema
const countrySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  isoCode: { type: String, required: true, unique: true },
  itucRightsRating: { type: Number, required: true },
  corruptionIndex: { type: Number, required: true },
  migrantWorkerPrevalence: { type: Number, required: true },
  wjpIndex: { type: Number, required: true },
  walkfreeSlaveryIndex: { type: Number, required: true },
  baseRiskScore: { type: Number, required: true }
});

const Country = mongoose.model('Country', countrySchema);

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrdd-risk')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes

// Get all countries
app.get('/api/countries', async (req, res) => {
  try {
    const countries = await Country.find({});
    res.json(countries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get country by ISO code
app.get('/api/countries/:isoCode', async (req, res) => {
  try {
    const country = await Country.findOne({ isoCode: req.params.isoCode });
    if (!country) {
      return res.status(404).json({ error: 'Country not found' });
    }
    res.json(country);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Calculate weighted risk score
app.post('/api/calculate-risk', async (req, res) => {
  try {
    const { countryIsoCode, weights } = req.body;
    
    const country = await Country.findOne({ isoCode: countryIsoCode });
    if (!country) {
      return res.status(404).json({ error: 'Country not found' });
    }

    // Calculate weighted risk score
    // Weights order: ITUC_Rights_Rating, Corruption_Index_TI, ILO_Migrant_Worker_Prevalence, WJP_index, Walkfree_Slavery_Index
    const values = [
      country.itucRightsRating,
      country.corruptionIndex,
      country.migrantWorkerPrevalence,
      country.wjpIndex,
      country.walkfreeSlaveryIndex
    ];

    let weightedSum = 0;
    let totalWeight = 0;

    for (let i = 0; i < values.length; i++) {
      if (values[i] > 0) { // Ignore zero values as specified
        weightedSum += values[i] * weights[i];
        totalWeight += weights[i];
      }
    }

    const weightedRiskScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

    res.json({
      country: country.name,
      isoCode: country.isoCode,
      originalRiskScore: country.baseRiskScore,
      weightedRiskScore: Math.round(weightedRiskScore * 100) / 100,
      riskBand: getRiskBand(weightedRiskScore)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to determine risk band
function getRiskBand(score) {
  if (score >= 0 && score < 20) return 'Low';
  if (score >= 20 && score < 40) return 'Medium';
  if (score >= 40 && score < 60) return 'Medium High';
  if (score >= 60 && score < 80) return 'High';
  if (score >= 80) return 'Very High';
  return 'Unknown';
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});