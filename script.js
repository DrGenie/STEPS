/****************************************************************************
 * SCRIPT.JS
 * 1) Tab switching, slider updates, and accordion toggling
 * 2) DCE model for FETP with realistic attribute coefficients
 * 3) Chart rendering for Adoption Likelihood and Cost–Benefit analysis
 * 4) Integration with Leaflet for an interactive map and Chart.js for a dashboard chart
 * 5) Scenario saving and PDF export
 ****************************************************************************/

/* Global variable for Leaflet map */
var leafletMap;

/* Tab Switching */
document.addEventListener("DOMContentLoaded", function() {
  var tabs = document.querySelectorAll(".tablink");
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].addEventListener("click", function() {
      openTab(this.getAttribute("data-tab"), this);
      if (this.getAttribute("data-tab") === "visualizationsTab") {
        renderMap();
        renderDashboard();
      }
    });
  }
  openTab("introTab", tabs[0]);
  
  var accordions = document.querySelectorAll(".accordion-item h3");
  for (var j = 0; j < accordions.length; j++) {
    accordions[j].addEventListener("click", function() {
      var content = this.nextElementSibling;
      content.style.display = (content.style.display === "block") ? "none" : "block";
    });
  }
});

/* Open Tab Function */
function openTab(tabId, clickedBtn) {
  var contents = document.getElementsByClassName("tabcontent");
  for (var i = 0; i < contents.length; i++) {
    contents[i].style.display = "none";
  }
  var buttons = document.getElementsByClassName("tablink");
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].classList.remove("active");
    buttons[i].setAttribute("aria-selected", "false");
  }
  document.getElementById(tabId).style.display = "block";
  clickedBtn.classList.add("active");
  clickedBtn.setAttribute("aria-selected", "true");
}

/* Slider Label Update */
function updateFETPCostDisplay(val) {
  document.getElementById("costLabelFETP").textContent = val;
}

/* DCE Coefficients and Attribute Mappings */
var mainCoefficients = {
  ASC_mean: -0.112,
  ASC_optout: 0.131,
  training_frontline: 0,
  training_intermediate: 0.300,
  training_advanced: 0.700,
  trainingModel_scholarship: 0.300,
  stipend_levels: {
    200: 0,
    400: 0.10,
    600: 0.20,
    800: 0.30
  },
  capacity_levels: {
    100: 0,
    500: 0.300,
    1000: 0.600,
    1500: 0.900,
    2000: 1.200
  },
  cost: -0.0001,
  delivery_online: 0,
  delivery_inperson: 0.426,
  delivery_hybrid: 0.189,
  trainingSites: {
    centralized: -0.100,
    stateCapitals: 0,
    zonalCenters: 0.200,
    decentralized: 0.300
  }
};

/* Build Scenario */
function buildFETPScenario() {
  var levelTraining = document.querySelector('input[name="levelTraining"]:checked') ? document.querySelector('input[name="levelTraining"]:checked').value : null;
  if (!levelTraining) { alert("Please select a Level of Training."); return null; }
  
  var trainingModel = document.querySelector('input[name="trainingModel"]:checked') ? document.querySelector('input[name="trainingModel"]:checked').value : null;
  if (!trainingModel) { alert("Please select a Training Model."); return null; }
  
  var stipendAmount = document.querySelector('input[name="stipendAmount"]:checked') ? document.querySelector('input[name="stipendAmount"]:checked').value : null;
  if (!stipendAmount) { alert("Please select a Stipend Amount."); return null; }
  
  var annualCapacity = document.querySelector('input[name="annualCapacity"]:checked') ? document.querySelector('input[name="annualCapacity"]:checked').value : null;
  if (!annualCapacity) { alert("Please select an Annual Training Capacity."); return null; }
  
  var deliveryMethod = document.querySelector('input[name="deliveryMethod"]:checked') ? document.querySelector('input[name="deliveryMethod"]:checked').value : null;
  if (!deliveryMethod) { alert("Please select a Delivery Method."); return null; }
  
  var trainingSites = document.querySelector('input[name="trainingSites"]:checked') ? document.querySelector('input[name="trainingSites"]:checked').value : null;
  if (!trainingSites) { alert("Please select a Number of Training Sites."); return null; }
  
  var feeSlider = document.getElementById("costSliderFETP");
  var fee = feeSlider ? parseInt(feeSlider.value, 10) : 2500;
  
  return {
    levelTraining: levelTraining,
    trainingModel: trainingModel,
    stipendAmount: parseInt(stipendAmount, 10),
    annualCapacity: parseInt(annualCapacity, 10),
    deliveryMethod: deliveryMethod,
    trainingSites: trainingSites,
    fee: fee
  };
}

/* Compute Uptake */
function computeFETPUptake(sc) {
  var U = mainCoefficients.ASC_mean;
  
  if (sc.levelTraining === "frontline") U += mainCoefficients.training_frontline;
  else if (sc.levelTraining === "intermediate") U += mainCoefficients.training_intermediate;
  else if (sc.levelTraining === "advanced") U += mainCoefficients.training_advanced;
  
  if (sc.trainingModel === "scholarship") U += mainCoefficients.trainingModel_scholarship;
  
  if (sc.stipendAmount in mainCoefficients.stipend_levels)
    U += mainCoefficients.stipend_levels[sc.stipendAmount];
  
  if (sc.annualCapacity in mainCoefficients.capacity_levels)
    U += mainCoefficients.capacity_levels[sc.annualCapacity];
  
  if (sc.deliveryMethod === "inperson") U += mainCoefficients.delivery_inperson;
  else if (sc.deliveryMethod === "hybrid") U += mainCoefficients.delivery_hybrid;
  
  if (sc.trainingSites in mainCoefficients.trainingSites)
    U += mainCoefficients.trainingSites[sc.trainingSites];
  
  U += mainCoefficients.cost * sc.fee;
  
  var altExp = Math.exp(U);
  var optExp = Math.exp(mainCoefficients.ASC_optout);
  return altExp / (altExp + optExp);
}

/* Open Results Modal */
function openFETPScenario() {
  var scenario = buildFETPScenario();
  if (!scenario) return;
  var fraction = computeFETPUptake(scenario);
  var pct = fraction * 100;
  
  var recommendation = "";
  if (pct < 30) {
    recommendation = "Uptake is low. Consider reducing the fee or revising programme features.";
  } else if (pct < 70) {
    recommendation = "Uptake is moderate. Small adjustments may further boost participation.";
  } else {
    recommendation = "Uptake is high. This configuration appears highly cost-effective.";
  }
  
  var modalHTML = "<h4>Calculation Results</h4>" +
                  "<p><strong>Predicted Uptake:</strong> " + pct.toFixed(2) + "%</p>" +
                  "<p><em>Recommendation:</em> " + recommendation + "</p>";
  document.getElementById("modalResults").innerHTML = modalHTML;
  document.getElementById("resultModal").style.display = "block";
  
  renderFETPProbChart();
  renderFETPCostsBenefits();
}

/* Close Modal */
function closeModal() {
  document.getElementById("resultModal").style.display = "none";
}

/* Render Predicted Uptake (Doughnut Chart) */
var probChartFETP = null;
function renderFETPProbChart() {
  var sc = buildFETPScenario();
  if (!sc) return;
  var fraction = computeFETPUptake(sc);
  var pct = fraction * 100;
  
  var ctx = document.getElementById("probChartFETP").getContext("2d");
  if (probChartFETP) probChartFETP.destroy();
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
        title: { display: true, text: "Adoption Likelihood: " + pct.toFixed(2) + "%", font: { size: 16 } }
      }
    }
  });
}

/* Render Cost–Benefit Chart */
var cbaFETPChart = null;
function renderFETPCostsBenefits() {
  var sc = buildFETPScenario();
  if (!sc) return;
  var uptakeFraction = computeFETPUptake(sc);
  var pct = uptakeFraction * 100;
  var trainees = sc.annualCapacity;
  
  var qVal = 0.05;
  var sel = document.getElementById("qalyFETPSelect");
  if (sel) {
    if (sel.value === "low") qVal = 0.01;
    else if (sel.value === "high") qVal = 0.08;
  }
  
  var fixedCost = 35500 + (sc.annualCapacity - 500) * 10;
  var totalCost = sc.fee * trainees + fixedCost;
  
  var totalQALY = trainees * qVal;
  var monetized = totalQALY * 50000;
  var netB = monetized - totalCost;
  
  var container = document.getElementById("costsFETPResults");
  if (!container) return;
  var econAdvice = "";
  if (netB < 0) {
    econAdvice = "The programme may not be cost-effective. Consider reducing the fee or revising programme features.";
  } else if (netB < 50000) {
    econAdvice = "The configuration shows modest benefits. Further improvements could enhance cost-effectiveness.";
  } else {
    econAdvice = "This configuration appears highly cost-effective.";
  }
  
  container.innerHTML = "<div class='calculation-info'>" +
                        "<p><strong>Predicted Uptake:</strong> " + pct.toFixed(2) + "%</p>" +
                        "<p><strong>Number of Trainees:</strong> " + trainees + "</p>" +
                        "<p><strong>Total Training Cost:</strong> $" + totalCost.toFixed(2) + "</p>" +
                        "<p><strong>Monetised Benefits:</strong> $" + monetized.toLocaleString() + "</p>" +
                        "<p><strong>Net Benefit:</strong> $" + netB.toLocaleString() + "</p>" +
                        "<p><em>Policy Recommendation:</em> " + econAdvice + "</p>" +
                        "</div>" +
                        "<div class='chart-box' style='height:350px;'>" +
                        "<h3>Cost-Benefit Analysis</h3>" +
                        "<canvas id='cbaFETPChart'></canvas>" +
                        "</div>";
  var ctx = document.getElementById("cbaFETPChart").getContext("2d");
  if (cbaFETPChart) cbaFETPChart.destroy();
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

/* Toggle Cost Breakdown */
function toggleCostAccordion() {
  var acc = document.getElementById("detailedCostBreakdown");
  acc.style.display = (acc.style.display === "block") ? "none" : "block";
}

/* Toggle Benefits Explanation */
function toggleFETPBenefitsAnalysis() {
  var box = document.getElementById("detailedFETPBenefitsAnalysis");
  if (!box) return;
  box.style.display = (box.style.display === "flex") ? "none" : "flex";
}

/* Render Interactive Map using Leaflet */
function renderMap() {
  if (!leafletMap) {
    leafletMap = L.map('mapContainer').setView([20.5937, 78.9629], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(leafletMap);
    L.marker([28.6139, 77.2090]).addTo(leafletMap).bindPopup('New Delhi - Multiple State Capitals');
    L.marker([19.0760, 72.8777]).addTo(leafletMap).bindPopup('Mumbai - Single Centralized Hub');
    L.marker([13.0827, 80.2707]).addTo(leafletMap).bindPopup('Chennai - Zonal Regional Center');
    L.marker([22.5726, 88.3639]).addTo(leafletMap).bindPopup('Kolkata - Decentralized Rural Node');
  } else {
    leafletMap.invalidateSize();
  }
}

/* Render Dashboard Chart for Cost Distribution */
function renderDashboard() {
  var ctx = document.getElementById('dashboardChart').getContext('2d');
  if (window.dashboardChartInstance) {
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

/* Scenario Saving & PDF Export */
var savedFETPScenarios = [];
function saveFETPScenario() {
  var sc = buildFETPScenario();
  if (!sc) return;
  var uptakeFraction = computeFETPUptake(sc);
  var pct = uptakeFraction * 100;
  sc.uptake = pct.toFixed(2);
  var netB = (pct * 1000).toFixed(2);
  sc.netBenefit = netB;
  
  sc.name = "Scenario " + (savedFETPScenarios.length + 1);
  savedFETPScenarios.push(sc);
  
  var tb = document.querySelector("#FETPScenarioTable tbody");
  var row = document.createElement("tr");
  row.innerHTML = "<td>" + sc.name + "</td>" +
                  "<td>$" + sc.fee + "</td>" +
                  "<td>" + sc.levelTraining + "</td>" +
                  "<td>" + sc.trainingModel + "</td>" +
                  "<td>$" + sc.stipendAmount + "</td>" +
                  "<td>" + sc.annualCapacity + "</td>" +
                  "<td>" + sc.deliveryMethod + "</td>" +
                  "<td>" + sc.trainingSites + "</td>" +
                  "<td>" + sc.uptake + "%</td>" +
                  "<td>$" + sc.netBenefit + "</td>";
  tb.appendChild(row);
  alert('"' + sc.name + '" saved successfully.');
}

function exportFETPComparison() {
  if (!savedFETPScenarios.length) {
    alert("No scenarios saved.");
    return;
  }
  var jsPDF = window.jspdf.jsPDF;
  var doc = new jsPDF({ unit: "mm", format: "a4" });
  var yPos = 15;
  doc.setFontSize(16);
  doc.text("FETP Scenarios Comparison", 105, yPos, { align: "center" });
  yPos += 10;
  
  savedFETPScenarios.forEach(function(sc, idx) {
    if (yPos + 60 > doc.internal.pageSize.getHeight() - 15) {
      doc.addPage();
      yPos = 15;
    }
    doc.setFontSize(14);
    doc.text("Scenario " + (idx + 1) + ": " + sc.name, 15, yPos);
    yPos += 7;
    doc.setFontSize(12);
    doc.text("Fee: $" + sc.fee, 15, yPos); yPos += 5;
    doc.text("Level: " + sc.levelTraining, 15, yPos); yPos += 5;
    doc.text("Model: " + sc.trainingModel, 15, yPos); yPos += 5;
    doc.text("Stipend: $" + sc.stipendAmount, 15, yPos); yPos += 5;
    doc.text("Capacity: " + sc.annualCapacity, 15, yPos); yPos += 5;
    doc.text("Delivery: " + sc.deliveryMethod, 15, yPos); yPos += 5;
    doc.text("Sites: " + sc.trainingSites, 15, yPos); yPos += 5;
    doc.text("Uptake: " + sc.uptake + "%, Net Benefit: $" + sc.netBenefit, 15, yPos);
    yPos += 10;
  });
  
  doc.save("FETPScenarios_Comparison.pdf");
}
