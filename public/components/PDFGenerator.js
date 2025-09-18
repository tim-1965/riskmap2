// PDFGenerator.js - PDF Report Generation for HRDD Risk Assessment Tool
export class PDFGenerator {
  constructor() {
    this.jsPDFLoaded = false;
    this.html2canvasLoaded = false;
    this.loadingPromises = new Map();
  }

  async loadLibrary(libName, scriptSrc, globalCheck) {
    if (this.loadingPromises.has(libName)) {
      return this.loadingPromises.get(libName);
    }

    if (globalCheck()) {
      this[`${libName}Loaded`] = true;
      return Promise.resolve();
    }

    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = scriptSrc;
      script.onload = () => {
        this[`${libName}Loaded`] = true;
        resolve();
      };
      script.onerror = () => reject(new Error(`Failed to load ${libName}`));
      document.head.appendChild(script);
    });

    this.loadingPromises.set(libName, promise);
    return promise;
  }

  async loadRequiredLibraries() {
    const jsPDFPromise = this.loadLibrary(
      'jsPDF',
      'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
      () => typeof window.jsPDF !== 'undefined'
    );

    const html2canvasPromise = this.loadLibrary(
      'html2canvas',
      'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
      () => typeof html2canvas !== 'undefined'
    );

    await Promise.all([jsPDFPromise, html2canvasPromise]);
  }

  createLoadingModal() {
    const modal = document.createElement('div');
    modal.id = 'pdfLoadingModal';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8);
      display: flex; align-items: center; justify-content: center; z-index: 10000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;
    modal.innerHTML = `
      <div style="background: white; padding: 40px; border-radius: 12px; text-align: center; max-width: 400px;">
        <div style="width: 40px; height: 40px; border: 4px solid #f3f4f6; border-top: 4px solid #3b82f6; 
                    border-radius: 50%; margin: 0 auto 20px; animation: spin 1s linear infinite;"></div>
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: #1f2937;">Generating Report</h3>
        <div id="pdfProgress" style="color: #6b7280; font-size: 14px;">Initializing PDF generation...</div>
      </div>
      <style>
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      </style>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  updateProgress(message) {
    const progressElement = document.getElementById('pdfProgress');
    if (progressElement) {
      progressElement.textContent = message;
    }
  }

  removeLoadingModal() {
    const modal = document.getElementById('pdfLoadingModal');
    if (modal) {
      modal.remove();
    }
  }

  async captureElement(element, options = {}) {
    if (!element) return null;

    const defaultOptions = {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: element.offsetWidth,
      height: element.offsetHeight,
      scrollX: 0,
      scrollY: 0,
      ...options
    };

    try {
      // Handle SVG elements specifically (like D3 maps)
      const svgElements = element.querySelectorAll('svg');
      const svgDataUrls = [];
      
      for (let svg of svgElements) {
        try {
          const svgData = new XMLSerializer().serializeToString(svg);
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const img = new Image();
          
          canvas.width = svg.clientWidth || 800;
          canvas.height = svg.clientHeight || 400;
          
          const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(svgBlob);
          
          await new Promise((resolve, reject) => {
            img.onload = () => {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              URL.revokeObjectURL(url);
              resolve();
            };
            img.onerror = reject;
            img.src = url;
          });
          
          svgDataUrls.push({ svg, dataUrl: canvas.toDataURL('image/png') });
        } catch (error) {
          console.warn('Failed to convert SVG to image:', error);
        }
      }

      // Temporarily replace SVGs with images
      const originalSvgs = [];
      svgDataUrls.forEach(({ svg, dataUrl }) => {
        const img = document.createElement('img');
        img.src = dataUrl;
        img.style.width = svg.style.width || `${svg.clientWidth}px`;
        img.style.height = svg.style.height || `${svg.clientHeight}px`;
        img.style.maxWidth = '100%';
        originalSvgs.push({ svg, img });
        svg.parentNode.insertBefore(img, svg);
        svg.style.display = 'none';
      });

      const canvas = await html2canvas(element, defaultOptions);

      // Restore original SVGs
      originalSvgs.forEach(({ svg, img }) => {
        svg.style.display = '';
        img.remove();
      });

      return canvas;
    } catch (error) {
      console.error('Error capturing element:', error);
      return null;
    }
  }

  async generatePanelContent(appInstance, panelNumber) {
    // Temporarily switch to the panel
    const originalPanel = appInstance.state.currentPanel;
    appInstance.state.currentPanel = panelNumber;
    appInstance.render();

    // Wait for rendering to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Capture the panel content
    const panelContent = document.getElementById('panelContent');
    if (!panelContent) {
      appInstance.state.currentPanel = originalPanel;
      appInstance.render();
      return null;
    }

    const canvas = await this.captureElement(panelContent);
    
    // Restore original panel
    appInstance.state.currentPanel = originalPanel;
    appInstance.render();
    
    return canvas;
  }

  addPageContent(pdf, canvas, pageNumber, panelTitle) {
    if (!canvas) return;

    const pageWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;
    const maxContentHeight = pageHeight - 2 * margin - 20; // Reserve space for header

    if (pageNumber > 1) {
      pdf.addPage();
    }

    // Add header
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`Panel ${pageNumber}: ${panelTitle}`, margin, margin);
    
    // Add page number
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Page ${pageNumber}`, pageWidth - margin - 20, margin);

    // Calculate image dimensions
    const canvasAspectRatio = canvas.width / canvas.height;
    let imgWidth = contentWidth;
    let imgHeight = imgWidth / canvasAspectRatio;

    // If image is too tall, scale down
    if (imgHeight > maxContentHeight) {
      imgHeight = maxContentHeight;
      imgWidth = imgHeight * canvasAspectRatio;
    }

    // Center the image horizontally
    const imgX = margin + (contentWidth - imgWidth) / 2;
    const imgY = margin + 20;

    try {
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth, imgHeight);
    } catch (error) {
      console.error('Error adding image to PDF:', error);
      // Add error message instead
      pdf.setFontSize(12);
      pdf.text('Error: Could not capture panel content', margin, margin + 40);
    }
  }

  async generateReport(appInstance) {
    const modal = this.createLoadingModal();
    
    try {
      this.updateProgress('Loading PDF libraries...');
      await this.loadRequiredLibraries();

      this.updateProgress('Initializing PDF document...');
      const { jsPDF } = window;
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const panelTitles = {
        1: 'Global Risks',
        2: 'Baseline Risk',
        3: 'HRDD Strategy',
        4: 'Response Strategy',
        5: 'Managed Risk'
      };

      // Add title page
      pdf.setFontSize(24);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Labour Rights Due Diligence', 105, 60, { align: 'center' });
      pdf.text('Risk Assessment Report', 105, 80, { align: 'center' });
      
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Complete 5-Panel Coverage-Based Risk Management Analysis', 105, 100, { align: 'center' });
      
      pdf.setFontSize(12);
      const now = new Date();
      pdf.text(`Generated: ${now.toLocaleString()}`, 105, 120, { align: 'center' });
      
      // Add summary information
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Portfolio Summary', 20, 160);
      
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      const summaryY = 175;
      pdf.text(`Selected Countries: ${appInstance.state.selectedCountries.length}`, 20, summaryY);
      pdf.text(`Baseline Risk: ${appInstance.state.baselineRisk.toFixed(1)}`, 20, summaryY + 10);
      pdf.text(`Managed Risk: ${appInstance.state.managedRisk.toFixed(1)}`, 20, summaryY + 20);
      
      const riskReduction = ((appInstance.state.baselineRisk - appInstance.state.managedRisk) / appInstance.state.baselineRisk * 100);
      pdf.text(`Risk Reduction: ${riskReduction.toFixed(1)}%`, 20, summaryY + 30);

      // Generate each panel
      for (let panelNumber = 1; panelNumber <= 5; panelNumber++) {
        this.updateProgress(`Capturing Panel ${panelNumber}: ${panelTitles[panelNumber]}...`);
        
        const canvas = await this.generatePanelContent(appInstance, panelNumber);
        this.addPageContent(pdf, canvas, panelNumber, panelTitles[panelNumber]);
        
        // Add a small delay between panels
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      this.updateProgress('Finalizing PDF...');
      
      // Generate filename with timestamp
      const timestamp = now.toISOString().slice(0, 10);
      const filename = `HRDD_Risk_Assessment_Report_${timestamp}.pdf`;
      
      // Save the PDF
      pdf.save(filename);
      
      this.updateProgress('Report generated successfully!');
      
      // Show success message briefly before closing
      setTimeout(() => {
        this.removeLoadingModal();
      }, 1000);

    } catch (error) {
      console.error('Error generating PDF report:', error);
      this.updateProgress('Error generating report. Please try again.');
      
      setTimeout(() => {
        this.removeLoadingModal();
        alert('Failed to generate PDF report. Please ensure you have a stable internet connection and try again.');
      }, 2000);
    }
  }
}

export const pdfGenerator = new PDFGenerator();