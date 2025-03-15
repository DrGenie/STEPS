/****************************************************************************
 * SCRIPT.JS
 * 1) Tab switching, slider updates, and accordion toggling
 * 2) DCE model for FETP with updated attributes and realistic restrictions
 * 3) Chart rendering for WTP, predicted uptake, and dynamic cost–benefit analysis
 * 4) Integration with Leaflet for interactive maps and Chart.js for dashboard visualization
 * 5) Scenario saving and PDF export
 ****************************************************************************/

/** On DOM load, set up tabs and accordion toggles */
document.addEventListener("DOMContentLoaded", function(){
  const tabs = document.querySelectorAll(".tablink");
  tabs.forEach(btn => {
    btn.addEventListener("click", function(){
      openTab(this.getAttribute("data-tab"), this);
      if(this.getAttribute("data-tab") === "visualizationsTab"){
        renderMap();
        renderDashboard();
      }
    });
  });
  openTab("introTab", document.querySelector(".tablink"));
  
  document.querySelectorAll(".accordion-item h3").forEach(item => {
    item.addEventListener("click", function(){
      const content = this.nextElementSibling;
      content.style.display = content.style.display === "block" ? "none" : "block";
    });
  });
});

/** Tab switcher */
function openTab(tabId, clickedBtn){
  const allTabs = document.querySelectorAll(".tabcontent");
  allTabs.forEach(t => t.style.display = "none");
  const allBtns = document.querySelectorAll(".tablink");
  allBtns.forEach(b => {
    b.classList.remove("active");
    b.setAttribute("aria-selected", "false");
  });
  document.getElementById(tabId).style.display = "block";
  clickedBtn.classList.add("active");
  clickedBtn.setAttribute("aria-selected", "true");
}

/** Slider label update */
function updateFETPCostDisplay(val){
  document.getElementById("costLabelFETP").textContent = val;
}

/** DCE Coefficients and attribute mappings */
const mainCoefficients = {
  ASC_mean: -0.112,
  ASC_optout: 0.131,
  // Level of Training (Reference: Frontline)
  training_frontline: 0,
  training_intermediate: 0.300,
  training_advanced: 0.700,
  // Training Model (Reference: In-service)
  trainingModel_scholarship: 0.300,
  // Stipend Amount (USD levels)
  stipend_levels: {
    200: 0,
    400: 0.10,
    600: 0.20,
    800: 0.30
  },
  // Annual Training Capacity (higher is better)
  capacity_levels: {
    100: 0,
    500: 0.300,
    1000: 0.600,
    1500: 0.900,
    2000: 1.200
  },
  // Fee effect (per USD)
  cost: -0.0001,
  // Delivery Method (Reference: Online)
  delivery_online: 0,
  delivery_inperson: 0.426,
  delivery_hybrid: 0.189,
  // Number of Training Sites (Reference: Multiple State Capitals)
  trainingSites: {
    centralized: -0.100,
    stateCapitals: 0,
    zonalCenters: 0.200,
    decentralized: 0.300
  }
};

/** Build scenario from user inputs */
function buildFETPScenario(){
  const levelTraining = document.querySelector('input[name="levelTraining"]:checked')?.value;
  if(!levelTraining){ alert("Please select a Level of Training."); return null; }
  
  const trainingModel = document.querySelector('input[name="trainingModel"]:checked')?.value;
  if(!trainingModel){ alert("Please select a Training Model."); return null; }
  
  const stipendAmount = document.querySelector('input[name="stipendAmount"]:checked')?.value;
  if(!stipendAmount){ alert("Please select a Stipend Amount."); return null; }
  
  const annualCapacity = document.querySelector('input[name="annualCapacity"]:checked')?.value;
  if(!annualCapacity){ alert("Please select an Annual Training Capacity."); return null; }
  
  const deliveryMethod = document.querySelector('input[name="deliveryMethod"]:checked')?.value;
  if(!deliveryMethod){ alert("Please select a Delivery Method."); return null; }
  
  const trainingSites = document.querySelector('input[name="trainingSites"]:checked')?.value;
  if(!trainingSites){ alert("Please select a Number of Training Sites."); return null; }
  
  const feeSlider = document.getElementById("costSliderFETP");
  let fee = 2500;
  if(feeSlider) fee = parseInt(feeSlider.value, 10);
  
  return {
    levelTraining,
    trainingModel,
    stipendAmount: parseInt(stipendAmount, 10),
    annualCapacity: parseInt(annualCapacity, 10),
    deliveryMethod,
    trainingSites,
    fee
  };
}

/** Compute uptake using the DCE model */
function computeFETPUptake(sc){
  let U = mainCoefficients.ASC_mean;
  
  if(sc.levelTraining === "frontline") U += mainCoefficients.training_frontline;
  else if(sc.levelTraining === "intermediate") U += mainCoefficients.training_intermediate;
  else if(sc.levelTraining === "advanced") U += mainCoefficients.training_advanced;
  
  if(sc.trainingModel === "scholarship") U += mainCoefficients.trainingModel_scholarship;
  
  if(sc.stipendAmount in mainCoefficients.stipend_levels)
    U += mainCoefficients.stipend_levels[sc.stipendAmount];
  
  if(sc.annualCapacity in mainCoefficients.capacity_levels)
    U += mainCoefficients.capacity_levels[sc.annualCapacity];
  
  if(sc.deliveryMethod === "inperson") U += mainCoefficients.delivery_inperson;
  else if(sc.deliveryMethod === "hybrid") U += mainCoefficients.delivery_hybrid;
  
  if(sc.trainingSites in mainCoefficients.trainingSites)
    U += mainCoefficients.trainingSites[sc.trainingSites];
  
  U += mainCoefficients.cost * sc.fee;
  
  const altExp = Math.exp(U);
  const optExp = Math.exp(mainCoefficients.ASC_optout);
  return altExp / (altExp + optExp);
}

/** "Calculate & View Results" - display results in popup modal */
function openFETPScenario(){
  const scenario = buildFETPScenario();
  if(!scenario) return;
  const fraction = computeFETPUptake(scenario);
  const pct = fraction * 100;
  
  let recommendation = "";
  if(pct < 30){
    recommendation = "Uptake is low. Consider reducing the fee or revising programme features.";
  } else if(pct < 70){
    recommendation = "Uptake is moderate. Small adjustments may further boost participation.";
  } else {
    recommendation = "Uptake is high. This configuration appears highly cost-effective.";
  }
  
  const modalHTML = `
    <h4>Calculation Results</h4>
    <p><strong>Predicted Uptake:</strong> ${pct.toFixed(2)}%</p>
    <p><em>Recommendation:</em> ${recommendation}</p>
  `;
  document.getElementById("modalResults").innerHTML = modalHTML;
  document.getElementById("resultModal").style.display = "block";
  
  renderFETPProbChart();
  renderFETPCostsBenefits();
}

/** Close modal */
function closeModal(){
  document.getElementById("resultModal").style.display = "none";
}

/** Render WTP chart */
let wtpChart = null;
function renderWTPChart(){
  const ctx = document.getElementById("wtpChartMain").getContext("2d");
  if(!ctx) return;
  if(wtpChart) wtpChart.destroy();
  
  function ratio(coef){ return (coef / -mainCoefficients.cost) * 1; }
  const labels = [
    "Training: Advanced", "Training: Intermediate",
    "Training Model: Scholarship", "Stipend Increment",
    "Capacity Increase", "Delivery: In-person", "Fee Increment",
    "Sites: Zonal Centers"
  ];
  const rawVals = [
    ratio(mainCoefficients.training_advanced),
    ratio(mainCoefficients.training_intermediate),
    ratio(mainCoefficients.trainingModel_scholarship),
    ratio(mainCoefficients.stipend_levels[400]),
    ratio(mainCoefficients.capacity_levels[100]),
    ratio(mainCoefficients.delivery_inperson),
    ratio(mainCoefficients.cost) * 1000,
    ratio(mainCoefficients.trainingSites.zonalCenters)
  ];
  const errs = rawVals.map(v => Math.abs(v)*0.1);
  
  const minVal = Math.min(...rawVals);
  const maxVal = Math.max(...rawVals);
  const padding = 0.15;
  const yMin = minVal >= 0 ? 0 : (minVal * (1 + padding));
  const yMax = maxVal <= 0 ? 0 : (maxVal * (1 + padding));
  
  wtpChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "WTP (USD)",
        data: rawVals,
        backgroundColor: rawVals.map(v => v >= 0 ? "rgba(52,152,219,0.6)" : "rgba(231,76,60,0.6)"),
        borderColor: rawVals.map(v => v >= 0 ? "rgba(52,152,219,1)" : "rgba(231,76,60,1)"),
        borderWidth: 1,
        error: errs
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { min: yMin, max: yMax } },
      plugins: {
        legend: { display: false },
        title: { display: true, text: "WTP (USD) for FETP Attributes", font: { size: 16 } }
      }
    },
    plugins: [{
      id: "errorbars",
      afterDraw: chart => {
        const { ctx, scales: { y } } = chart;
        const dataset = chart.getDatasetMeta(0).data;
        dataset.forEach((bar, i) => {
          const xCenter = bar.x;
          const val = rawVals[i];
          const se = errs[i];
          if(typeof se === "number"){
            const top = y.getPixelForValue(val + se);
            const bot = y.getPixelForValue(val - se);
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 1;
            ctx.moveTo(xCenter, top);
            ctx.lineTo(xCenter, bot);
            ctx.moveTo(xCenter - 5, top);
            ctx.lineTo(xCenter + 5, top);
            ctx.moveTo(xCenter - 5, bot);
            ctx.lineTo(xCenter + 5, bot);
            ctx.stroke();
            ctx.restore();
          }
        });
      }
    }]
  });
}

/** Render predicted uptake (doughnut chart) */
let probChartFETP = null;
function renderFETPProbChart(){
  const sc = buildFETPScenario();
  if(!sc) return;
  const fraction = computeFETPUptake(sc);
  const pct = fraction * 100;
  
  const ctx = document.getElementById("probChartFETP").getContext("2d");
  if(probChartFETP) probChartFETP.destroy();
  probChartFETP = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Uptake", "Non-uptake"],
      datasets: [{
        data: [pct, 100 - pct],
        backgroundColor: ["#28a745", "#dc3545"]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: `Predicted Uptake: ${pct.toFixed(2)}%`, font: { size: 16 } }
      }
    }
  });
}

/** Render Cost–Benefit Chart */
let cbaFETPChart = null;
function renderFETPCostsBenefits(){
  const sc = buildFETPScenario();
  if(!sc) return;
  const uptakeFraction = computeFETPUptake(sc);
  const pct = uptakeFraction * 100;
  const trainees = sc.annualCapacity;
  
  let qVal = 0.05;
  const sel = document.getElementById("qalyFETPSelect");
  if(sel){
    if(sel.value === "low") qVal = 0.01;
    else if(sel.value === "high") qVal = 0.08;
  }
  
  const fixedCost = 35500 + (sc.annualCapacity - 500) * 10;
  const totalCost = sc.fee * trainees + fixedCost;
  
  const totalQALY = trainees * qVal;
  const monetized = totalQALY * 50000;
  const netB = monetized - totalCost;
  
  const container = document.getElementById("costsFETPResults");
  if(!container) return;
  let econAdvice = "";
  if(netB < 0){
    econAdvice = "The programme may not be cost-effective. Consider reducing the fee or revising programme features.";
  } else if(netB < 50000){
    econAdvice = "The configuration shows modest benefits. Further improvements could enhance cost-effectiveness.";
  } else {
    econAdvice = "This configuration appears highly cost-effective.";
  }
  
  container.innerHTML = `
    <div class="calculation-info">
      <p><strong>Predicted Uptake:</strong> ${pct.toFixed(2)}%</p>
      <p><strong>Number of Trainees:</strong> ${trainees}</p>
      <p><strong>Total Training Cost:</strong> $${totalCost.toFixed(2)}</p>
      <p><strong>Monetised Benefits:</strong> $${monetized.toLocaleString()}</p>
      <p><strong>Net Benefit:</strong> $${netB.toLocaleString()}</p>
      <p><em>Policy Recommendation:</em> ${econAdvice}</p>
    </div>
    <div class="chart-box" style="height:350px;">
      <h3>Cost-Benefit Analysis</h3>
      <canvas id="cbaFETPChart"></canvas>
    </div>
  `;
  const ctx = document.getElementById("cbaFETPChart").getContext("2d");
  if(cbaFETPChart) cbaFETPChart.destroy();
  
  cbaFETPChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Total Cost", "Monetised Benefits", "Net Benefit"],
      datasets: [{
        label: "USD",
        data: [totalCost, monetized, netB],
        backgroundColor: ["#c0392b", "#27ae60", "#f1c40f"]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: false } },
      plugins: {
        title: { display: true, text: "Cost-Benefit Analysis (FETP)", font: { size: 16 } },
        legend: { display: false }
      }
    }
  });
}

/** Render Interactive Map using Leaflet */
function renderMap(){
  var map = L.map('mapContainer').setView([20.5937, 78.9629], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  L.marker([28.6139, 77.2090]).addTo(map).bindPopup('New Delhi - Multiple State Capitals');
  L.marker([19.0760, 72.8777]).addTo(map).bindPopup('Mumbai - Single Centralized Hub');
  L.marker([13.0827, 80.2707]).addTo(map).bindPopup('Chennai - Zonal Regional Center');
  L.marker([22.5726, 88.3639]).addTo(map).bindPopup('Kolkata - Decentralized Rural Node');
}

/** Render Dashboard Chart for Cost Distribution */
function renderDashboard(){
  const ctx = document.getElementById('dashboardChart').getContext('2d');
  if(window.dashboardChartInstance) {
    window.dashboardChartInstance.destroy();
  }
  window.dashboardChartInstance = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ['Direct Costs', 'Indirect Costs', 'Recurring Costs'],
      datasets: [{
        data: [50, 30, 20],
        backgroundColor: ['#c0392b', '#27ae60', '#f1c40f']
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: 'Cost Distribution'
        },
        legend: {
          position: 'bottom'
        }
      }
    }
  });
}

/** Render predicted uptake (doughnut chart) */
let probChartFETP = null;
function renderFETPProbChart(){
  const sc = buildFETPScenario();
  if(!sc) return;
  const fraction = computeFETPUptake(sc);
  const pct = fraction * 100;
  
  const ctx = document.getElementById("probChartFETP").getContext("2d");
  if(probChartFETP) probChartFETP.destroy();
  probChartFETP = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Uptake", "Non-uptake"],
      datasets: [{
        data: [pct, 100 - pct],
        backgroundColor: ["#28a745", "#dc3545"]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: `Predicted Uptake: ${pct.toFixed(2)}%`, font: { size: 16 } }
      }
    }
  });
}

/** Scenario Saving & PDF Export */
let savedFETPScenarios = [];
function saveFETPScenario(){
  const sc = buildFETPScenario();
  if(!sc) return;
  const uptakeFraction = computeFETPUptake(sc);
  const pct = uptakeFraction * 100;
  sc.uptake = pct.toFixed(2);
  const netB = (pct * 1000).toFixed(2);
  sc.netBenefit = netB;
  
  sc.name = `Scenario ${savedFETPScenarios.length + 1}`;
  savedFETPScenarios.push(sc);
  
  const tb = document.querySelector("#FETPScenarioTable tbody");
  const row = document.createElement("tr");
  row.innerHTML = `
    <td>${sc.name}</td>
    <td>$${sc.fee}</td>
    <td>${sc.levelTraining}</td>
    <td>${sc.trainingModel}</td>
    <td>$${sc.stipendAmount}</td>
    <td>${sc.annualCapacity}</td>
    <td>${sc.deliveryMethod}</td>
    <td>${sc.trainingSites}</td>
    <td>${sc.uptake}%</td>
    <td>$${sc.netBenefit}</td>
  `;
  tb.appendChild(row);
  alert(`"${sc.name}" saved successfully.`);
}

function exportFETPComparison(){
  if(!savedFETPScenarios.length){
    alert("No scenarios saved.");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:"mm", format:"a4" });
  let yPos = 15;
  doc.setFontSize(16);
  doc.text("FETP Scenarios Comparison", 105, yPos, { align:"center" });
  yPos += 10;
  
  savedFETPScenarios.forEach((sc, idx) => {
    if(yPos + 60 > doc.internal.pageSize.getHeight() - 15){
      doc.addPage();
      yPos = 15;
    }
    doc.setFontSize(14);
    doc.text(`Scenario ${idx + 1}: ${sc.name}`, 15, yPos);
    yPos += 7;
    doc.setFontSize(12);
    doc.text(`Fee: $${sc.fee}`, 15, yPos); yPos += 5;
    doc.text(`Level: ${sc.levelTraining}`, 15, yPos); yPos += 5;
    doc.text(`Model: ${sc.trainingModel}`, 15, yPos); yPos += 5;
    doc.text(`Stipend: $${sc.stipendAmount}`, 15, yPos); yPos += 5;
    doc.text(`Capacity: ${sc.annualCapacity}`, 15, yPos); yPos += 5;
    doc.text(`Delivery: ${sc.deliveryMethod}`, 15, yPos); yPos += 5;
    doc.text(`Sites: ${sc.trainingSites}`, 15, yPos); yPos += 5;
    doc.text(`Uptake: ${sc.uptake}%, Net Benefit: $${sc.netBenefit}`, 15, yPos);
    yPos += 10;
  });
  
  doc.save("FETPScenarios_Comparison.pdf");
}
