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

// Connect to MongoDB - check multiple possible variable names
const mongoUri = process.env.MONGODB_URI || process.env.MongoDB_URI || process.env.Monogdb_URI || process.env.MONGO_URL || process.env.Mongo_URL || process.env.MongoURL || 'mongodb://localhost:27017/hrdd-risk';

console.log('Attempting to connect to MongoDB with URI:', mongoUri.replace(/\/\/.*@/, '//***:***@')); // Hide credentials in logs

mongoose.connect(mongoUri)
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

// Test route to verify app is working
app.get('/', (req, res) => {
  res.json({ 
    message: 'HRDD Risk API is running',
    mongoUri: process.env.Mongo_URL ? 'Mongo_URL found' : 'Mongo_URL not found',
    mongoDbUri: process.env.MongoDB_URI ? 'MongoDB_URI found' : 'MongoDB_URI not found',
    monogdbUri: process.env.Monogdb_URI ? 'Monogdb_URI found (typo)' : 'Monogdb_URI not found',
    port: PORT
  });
});

// Temporary data import route (remove after use)
app.get('/import-data', async (req, res) => {
  try {
    // Clear existing data
    await Country.deleteMany({});
    
    // Your CSV data
    const csvData = `Country,ISO_Code,ITUC_Rights_Rating,Corruption_Index_TI,ILO_Migrant_Worker_Prevalence,WJP_ index 4.8,Walkfree_Slavery_Index,Base_Risk_Score
Afghanistan,AFG,100.0,83.0,0.2,63.5,13.0,82
Albania,ALB,45.0,58.0,0.2,51.9,11.8,50
Algeria,DZA,90.0,66.0,0.6,51.9,1.9,68
Angola,AGO,67.5,68.0,1.4,52.3,4.1,61
Argentina,ARG,67.5,63.0,4.3,34.0,4.2,56
Armenia,ARM,45.0,53.0,1.4,0.0,8.9,45
Australia,AUS,22.5,23.0,29.8,27.7,1.6,25
Austria,AUT,0.0,33.0,21.7,17.7,1.9,26
Azerbaijan,AZE,0.0,78.0,2.1,0.0,10.6,58
Bahamas,BHS,45.0,35.0,10.2,35.5,0.0,44
Bahrain,BHR,90.0,47.0,52.9,0.0,6.7,67
Bangladesh,BGD,90.0,77.0,1.7,56.3,7.1,74
Barbados,BRB,22.5,32.0,9.1,25.5,0.0,31
Belarus,BLR,90.0,67.0,0.9,58.4,11.3,71
Belgium,BEL,45.0,31.0,13.0,18.9,1.0,33
Belize,BLZ,0.0,0.0,16.5,50.3,0.0,47
Benin,BEN,67.5,55.0,1.4,41.3,3.0,54
Bhutan,BTN,0.0,28.0,0.7,0.0,0.0,27
Bolivia,BOL,45.0,72.0,0.2,50.1,7.2,54
Bosnia and Herzegovina,BIH,45.0,67.0,0.1,38.6,10.1,51
Botswana,BWA,67.5,43.0,6.7,41.4,1.8,50
Brazil,BRA,67.5,66.0,0.7,52.2,5.0,60
Bulgaria,BGR,45.0,57.0,0.2,34.5,8.5,46
Burkina Faso,BFA,67.5,59.0,0.7,46.2,3.7,56
Burundi,BDI,100.0,83.0,0.2,0.0,7.5,82
Cambodia,KHM,90.0,79.0,0.3,56.1,5.0,74
Cameroon,CMR,67.5,74.0,1.5,51.8,5.8,63
Canada,CAN,45.0,25.0,21.3,27.2,1.8,33
Cape Verde,CPV,0.0,38.0,1.7,0.0,0.0,37
Central African Republic,CAF,100.0,76.0,1.8,0.0,5.2,79
Chad,TCD,67.5,79.0,0.4,0.0,5.9,66
Chile,CHL,45.0,37.0,10.8,27.7,3.2,37
China,CHN,90.0,57.0,0.1,68.3,4.0,68
Colombia,COL,90.0,61.0,4.2,54.6,7.8,68
Comoros,COM,0.0,79.0,0.6,0.0,0.0,76
Congo (Democratic Republic),COD,67.5,80.0,0.1,52.3,0.0,76
Congo,COG,45.0,77.0,12.0,56.3,8.0,58
Costa Rica,CRI,67.5,42.0,12.2,37.3,3.2,49
Cote d'Ivoire,CIV,45.0,55.0,19.6,39.5,0.0,55
Croatia,HRV,22.5,53.0,0.9,29.2,7.3,35
Cuba,CUB,0.0,59.0,0.0,0.0,5.4,43
Cyprus,CYP,0.0,44.0,26.9,38.9,8.0,40
Czechia,CZE,22.5,44.0,4.9,24.6,4.2,31
Democratic Republic of Congo,COD,67.5,80.0,1.0,52.3,0.0,76
Denmark,DNK,0.0,10.0,8.4,7.1,0.6,9
Djibouti,DJI,67.5,69.0,5.0,0.0,7.1,62
Dominica,DMA,0.0,40.0,12.7,40.2,0.0,44
Dominican Republic,DOM,22.5,64.0,6.5,42.4,6.6,42
Ecuador,ECU,90.0,68.0,4.1,46.3,7.6,69
Egypt,EGY,90.0,70.0,1.0,63.5,4.3,72
El Salvador,SLV,67.5,70.0,0.7,47.9,8.1,62
Equatorial Guinea,GNQ,0.0,87.0,13.2,0.0,7.8,65
Eritrea,ERI,90.0,87.0,0.4,0.0,90.3,98
Estonia,EST,22.5,24.0,17.4,27.1,4.1,25
Eswatini,SWZ,90.0,73.0,2.0,0.0,3.6,73
Ethiopia,ETH,67.5,63.0,0.9,63.2,6.3,61
Fiji,FJI,67.5,45.0,0.5,0.0,0.0,60
Finland,FIN,22.5,12.0,7.2,17.6,1.4,17
France,FRA,22.5,33.0,7.9,23.3,2.1,26
Gabon,GAB,45.0,73.0,17.7,38.0,7.6,54
Gambia,GMB,0.0,62.0,4.6,54.4,6.5,50
Georgia,GEO,67.5,47.0,11.1,41.8,7.8,53
Germany,DEU,0.0,25.0,15.2,16.8,0.6,20
Ghana,GHA,22.5,58.0,0.6,47.6,2.9,39
Greece,GRC,67.5,51.0,3.9,40.3,6.4,53
Grenada,GRD,0.0,44.0,6.3,28.0,0.0,41
Guatemala,GTM,90.0,75.0,0.5,59.3,7.8,74
Guinea,GIN,67.5,72.0,0.8,42.3,4.0,61
Guinea-Bissau,GNB,67.5,79.0,1.4,0.0,4.5,65
Guyana,GUY,0.0,61.0,6.5,40.7,4.2,46
Haiti,HTI,100.0,84.0,0.1,51.7,8.2,80
Honduras,HND,90.0,78.0,0.4,50.7,7.0,73
Hong Kong,HKG,90.0,26.0,39.3,36.9,2.8,54
Hungary,HUN,67.5,59.0,0.9,40.9,6.6,56
Iceland,ISL,0.0,23.0,11.8,0.0,0.0,25
India,IND,90.0,62.0,0.3,49.5,8.0,67
Indonesia,IDN,90.0,63.0,0.0,36.7,6.7,65
Iran,IRN,90.0,77.0,3.2,77.0,7.1,78
Iraq,IRQ,90.0,74.0,0.6,0.0,5.5,73
Ireland,IRL,0.0,23.0,20.4,16.8,1.1,20
Israel,ISR,67.5,36.0,21.0,0.0,3.8,49
Italy,ITA,22.5,46.0,10.9,40.9,3.3,35
Jamaica,JAM,45.0,56.0,0.8,36.2,7.3,46
Japan,JPN,22.5,29.0,2.8,24.7,1.1,24
Jordan,JOR,90.0,51.0,42.4,45.6,10.0,67
Kazakhstan,KAZ,90.0,60.0,10.1,47.2,11.1,68
Kenya,KEN,67.5,68.0,0.8,45.4,5.0,60
Kuwait,KWT,90.0,54.0,66.8,45.8,13.0,71
Kyrgyzstan,KGZ,90.0,75.0,0.6,47.9,8.7,72
Laos,LAO,90.0,67.0,1.3,0.0,5.2,70
Latvia,LVA,22.5,41.0,11.8,22.0,3.4,29
Lebanon,LBN,67.5,78.0,21.2,55.4,7.6,68
Lesotho,LSO,67.5,63.0,100.0,0.0,1.6,69
Liberia,LBR,67.5,73.0,2.3,53.4,3.1,63
Libya,LBY,100.0,87.0,12.2,0.0,6.8,85
Lithuania,LTU,22.5,37.0,2.2,27.2,6.1,29
Luxembourg,LUX,0.0,19.0,54.1,19.9,0.0,29
Madagascar,MDG,67.5,74.0,0.2,47.3,4.6,62
Malawi,MWI,22.5,66.0,0.9,46.7,4.9,43
Malaysia,MYS,90.0,50.0,10.7,42.0,6.3,62
Maldives,MDV,0.0,62.0,7.1,0.0,0.0,62
Mali,MLI,67.5,73.0,99.8,41.7,5.2,70
Malta,MLT,0.0,54.0,39.0,21.7,0.0,51
Mauritania,MRT,90.0,70.0,3.2,54.6,32.0,76
Mauritius,MUS,45.0,49.0,2.3,35.1,1.5,42
Mexico,MEX,45.0,74.0,1.3,51.1,6.6,55
Moldova,MDA,22.5,57.0,7.9,46.2,9.5,41
Mongolia,MNG,0.0,67.0,0.0,44.7,4.0,55
Montenegro,MNE,45.0,54.0,4.1,29.5,0.0,50
Morocco,MAR,45.0,63.0,0.3,43.8,2.3,49
Mozambique,MOZ,45.0,75.0,1.0,56.2,3.0,56
Myanmar,MMR,100.0,84.0,0.1,49.3,12.1,80
Namibia,NAM,45.0,51.0,4.1,47.2,2.4,45
Nepal,NPL,45.0,66.0,0.4,50.0,3.3,51
Netherlands,NLD,22.5,22.0,6.5,18.8,0.6,21
New Zealand,NZL,22.5,17.0,27.5,23.7,1.6,22
Nicaragua,NIC,0.0,86.0,0.6,51.1,7.3,62
Niger,NER,67.5,66.0,100.0,40.6,4.6,67
Nigeria,NGA,90.0,74.0,0.2,53.7,7.8,72
North Macedonia,MKD,0.0,60.0,0.1,40.0,12.6,46
Norway,NOR,0.0,19.0,11.6,10.4,0.5,15
Oman,OMN,45.0,45.0,43.2,0.0,6.5,46
Pakistan,PAK,90.0,73.0,1.7,68.4,10.6,75
Panama,PAN,67.5,67.0,10.6,32.5,4.7,58
Papua New Guinea,PNG,0.0,69.0,0.3,0.0,10.3,51
Paraguay,PRY,45.0,76.0,0.9,51.0,6.4,56
Peru,PER,67.5,69.0,5.4,47.7,7.1,61
Philippines,PHL,90.0,67.0,0.1,48.8,7.8,69
Poland,POL,45.0,47.0,2.1,36.5,5.5,42
Portugal,PRT,22.5,43.0,6.3,33.3,3.8,32
Qatar,QAT,90.0,41.0,81.8,0.0,6.8,68
Romania,ROU,45.0,54.0,0.3,29.2,7.5,44
Russia,RUS,90.0,78.0,0.4,42.3,13.0,73
Rwanda,RWA,45.0,43.0,0.5,31.8,4.3,39
Sao Tome and Principe,STP,0.0,55.0,1.1,0.0,0.0,53
Saudi Arabia,SAU,90.0,41.0,38.8,0.0,21.3,66
Senegal,SEN,67.5,55.0,0.9,33.7,2.9,52
Serbia,SRB,67.5,65.0,0.4,36.1,7.0,57
Seychelles,SYC,0.0,28.0,5.3,0.0,0.0,28
Sierra Leone,SLE,67.5,67.0,0.5,54.1,3.4,61
Singapore,SGP,22.5,16.0,47.1,26.7,2.1,24
Slovakia,SVK,22.5,51.0,0.6,28.1,7.7,34
Slovenia,SVN,0.0,40.0,10.6,27.6,4.4,31
Solomon Islands,SLB,0.0,57.0,0.9,0.0,0.0,55
Somalia,SOM,100.0,91.0,0.8,0.0,6.2,85
South Africa,ZAF,45.0,59.0,5.9,32.6,2.7,46
South Korea,KOR,90.0,36.0,3.5,38.3,3.5,55
South Sudan,SSD,100.0,92.0,7.7,0.0,10.3,87
Spain,ESP,22.5,44.0,15.9,21.6,2.3,31
Sri Lanka,LKA,67.5,68.0,0.2,40.3,6.5,59
Sudan,SDN,100.0,85.0,2.9,71.1,4.0,83
Suriname,SUR,0.0,60.0,8.2,47.4,0.0,59
Sweden,SWE,0.0,20.0,8.6,18.3,0.6,17
Switzerland,CHE,45.0,19.0,29.0,0.0,0.5,31
Syria,SYR,100.0,88.0,3.6,0.0,8.7,85
Taiwan,TWN,22.5,33.0,4.9,0.0,1.7,25
Tajikistan,TJK,0.0,81.0,0.2,0.0,14.0,61
Tanzania,TZA,67.5,59.0,0.2,42.3,2.9,55
Thailand,THA,90.0,66.0,4.4,44.7,5.7,68
Togo,TGO,45.0,68.0,100.0,46.8,3.3,61
Trinidad and Tobago,TTO,67.5,59.0,8.3,34.9,4.7,55
Tunisia,TUN,90.0,61.0,0.5,56.7,2.3,67
Turkey,TUR,90.0,66.0,8.3,61.0,15.6,73
Turkmenistan,TKM,0.0,83.0,2.6,0.0,11.9,62
Uganda,UGA,67.5,74.0,0.6,61.2,4.2,65
Ukraine,UKR,90.0,65.0,13.4,37.0,12.8,68
United Arab Emirates,ARE,90.0,32.0,75.0,57.8,13.4,66
United Kingdom,GBR,67.5,29.0,16.5,30.7,1.8,43
United States of America,USA,67.5,35.0,9.9,43.7,3.3,48
Uruguay,URY,22.5,24.0,4.7,17.1,1.9,21
Uzbekistan,UZB,0.0,68.0,3.2,46.5,7.4,51
Vanuatu,VUT,0.0,50.0,1.1,0.0,0.0,49
Venezuela,VEN,90.0,90.0,4.4,51.7,9.5,79
Vietnam,VNM,67.5,60.0,0.3,36.7,4.1,55
Zambia,ZMB,67.5,61.0,0.4,59.1,5.1,60
Zimbabwe,ZWE,90.0,79.0,0.2,52.4,5.0,73`;

    // Parse CSV and insert data
    const countries = [];
    const lines = csvData.trim().split('\n');
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      
      const country = {
        name: values[0].replace(/"/g, ''),
        isoCode: values[1],
        itucRightsRating: parseFloat(values[2]),
        corruptionIndex: parseFloat(values[3]),
        migrantWorkerPrevalence: parseFloat(values[4]),
        wjpIndex: parseFloat(values[5]),
        walkfreeSlaveryIndex: parseFloat(values[6]),
        baseRiskScore: parseFloat(values[7])
      };
      
      countries.push(country);
    }

    await Country.insertMany(countries);
    
    res.json({ 
      message: 'Data imported successfully!', 
      count: countries.length 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get('/debug-env', (req, res) => {
  res.json({
    hasMongoURL: !!process.env.MongoURL,
    hasMongoDBURI: !!process.env.MONGODB_URI,
    hasMongoDB_URI: !!process.env.MongoDB_URI,
    hasMonogdbURI: !!process.env.Monogdb_URI,
    hasMONGO_URL: !!process.env.MONGO_URL,
    hasMongo_URL: !!process.env.Mongo_URL,
    nodeEnv: process.env.NODE_ENV,
    port: PORT,
    // Show first part of connection string (hide credentials)
    connectionString: mongoUri ? mongoUri.substring(0, 20) + '...' : 'none'
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});