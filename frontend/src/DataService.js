// DataService.js - Handles all API calls to the backend
export class DataService {
  constructor() {
    this.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
  }

  async getAllCountries() {
    try {
      const response = await fetch(`${this.baseURL}/countries`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching countries:', error);
      throw error;
    }
  }

  async getCountry(isoCode) {
    try {
      const response = await fetch(`${this.baseURL}/countries/${isoCode}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching country:', error);
      throw error;
    }
  }

  async calculateRisk(countryIsoCode, weights) {
    try {
      const response = await fetch(`${this.baseURL}/calculate-risk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          countryIsoCode,
          weights
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error calculating risk:', error);
      throw error;
    }
  }
}

export const dataService = new DataService();