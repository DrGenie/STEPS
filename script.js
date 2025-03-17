/****************************************************************************
 * SCRIPT.JS
 * 1) Tab switching, slider updates, and accordion toggling
 * 2) DCE model for FETP with realistic attribute coefficients
 * 3) Chart rendering for Program Adoption Likelihood, dynamic cost–benefit analysis, and a Cost-Benefit Analysis chart
 * 4) Integration with Leaflet for an interactive map & Chart.js for cost distribution
 * 5) Scenario saving & PDF export (overall and individual)
 * 6) FAQ overlay for computed metrics with detailed explanations and examples
 ****************************************************************************/

/* Global variables */
var leafletMap;
var regionalChart, trendChart, costBenefitChart;

/* Tab Switching */
document.addEventListener("DOMContentLoaded", function() {
  var tabs = document.querySelectorAll(".tablink");
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].addEventListener("click", function() {
      openTab(this.getAttribute("data-tab"), this);
    });
  }
  openTab("introTab", tabs[0]);
  
  // Accordions
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
  for (var i = 0; i < contents.length; i++) { contents[i].style.display = "none"; }
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
  stipend_levels: { 200: 0, 400: 0.10, 600: 0.20, 800: 0.30 },
  capacity_levels: { 100: 0, 500: 0.300, 1000: 0.600, 1500: 0.900, 2000: 1.200 },
  cost: -0.0001,
  delivery_online: 0,
  delivery_inperson: 0.426,
  delivery_hybrid: 0.189,
  trainingSites: { centralized: -0.100, stateCapitals: 0, zonalCenters: 0.200, decentralized: 0.300 }
};

/* Build Scenario */
function buildFETPScenario() {
  var levelTraining = document.querySelector('input[name="levelTraining"]:checked') ? document.querySelector('input[name="levelTraining"]:checked').value : null;
  var trainingModel = document.querySelector('input[name="trainingModel"]:checked') ? document.querySelector('input[name="trainingModel"]:checked').value : null;
  var stipendAmount = document.querySelector('input[name="stipendAmount"]:checked') ? document.querySelector('input[name="stipendAmount"]:checked').value : null;
  var annualCapacity = document.querySelector('input[name="annualCapacity"]:checked') ? document.querySelector('input[name="annualCapacity"]:checked').value : null;
  var deliveryMethod = document.querySelector('input[name="deliveryMethod"]:checked') ? document.querySelector('input[name="deliveryMethod"]:checked').value : null;
  var trainingSites = document.querySelector('input[name="trainingSites"]:checked') ? document.querySelector('input[name="trainingSites"]:checked').value : null;
  var feeSlider = document.getElementById("costSliderFETP");
  var fee = feeSlider ? parseInt(feeSlider.value, 10) : 2500;
  if(!levelTraining || !trainingModel || !stipendAmount || !annualCapacity || !deliveryMethod || !trainingSites) return null;
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
  if (sc.stipendAmount in mainCoefficients.stipend_levels) U += mainCoefficients.stipend_levels[sc.stipendAmount];
  if (sc.annualCapacity in mainCoefficients.capacity_levels) U += mainCoefficients.capacity_levels[sc.annualCapacity];
  if (sc.deliveryMethod === "inperson") U += mainCoefficients.delivery_inperson;
  else if (sc.deliveryMethod === "hybrid") U += mainCoefficients.delivery_hybrid;
  if (sc.trainingSites in mainCoefficients.trainingSites) U += mainCoefficients.trainingSites[sc.trainingSites];
  U += mainCoefficients.cost * sc.fee;
  var altExp = Math.exp(U);
  var optExp = Math.exp(mainCoefficients.ASC_optout);
  return altExp / (altExp + optExp);
}

/* Open Results Modal */
function openFETPScenario() {
  var scenario = buildFETPScenario();
  if (!scenario) { alert("Please select all required fields before calculating."); return; }
  var fraction = computeFETPUptake(scenario);
  var pct = fraction * 100;
  var recommendation = (pct < 30) ? "Uptake is low. Consider reducing the fee or revising features." :
                        (pct < 70) ? "Uptake is moderate. Small adjustments may boost participation." :
                                     "Uptake is high. This configuration appears highly cost-effective.";
  var modalHTML = "<h4>Calculation Results</h4>" +
                  "<p><strong>Predicted Uptake:</strong> " + pct.toFixed(2) + "%</p>" +
                  "<p><em>Recommendation:</em> " + recommendation + "</p>";
  document.getElementById("modalResults").innerHTML = modalHTML;
  document.getElementById("resultModal").style.display = "block";
  renderFETPProbChart();
  renderFETPCostsBenefits();
  renderCostBenefitChart();
}

/* Close Modal */
function closeModal() {
  document.getElementById("resultModal").style.display = "none";
}

/* Render Program Adoption Likelihood (Doughnut Chart) */
var probChartFETP = null;
function renderFETPProbChart() {
  var scenario = buildFETPScenario();
  if (!scenario) { alert("Please select all required fields first."); return; }
  var fraction = computeFETPUptake(scenario);
  var pct = fraction * 100;
  var ctx = document.getElementById("probChartFETP").getContext("2d");
  if (probChartFETP) probChartFETP.destroy();
  probChartFETP = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Uptake", "Non-uptake"],
      datasets: [{ data: [pct, 100 - pct], backgroundColor: ["#28a745", "#dc3545"] }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { animateScale: true, animateRotate: true },
      plugins: { title: { display: true, text: "Program Adoption Likelihood: " + pct.toFixed(2) + "%", font: { size: 16 } } }
    }
  });
}

/* Render Cost–Benefit Analysis & Dynamic Cost Estimation */
var cbaFETPChart = null;
function renderFETPCostsBenefits() {
  var scenario = buildFETPScenario();
  if (!scenario) { document.getElementById("costsFETPResults").innerHTML = "<p>Please select all inputs before computing costs.</p>"; return; }
  var trainees = scenario.annualCapacity;
  var effectiveEnrollment = trainees * computeFETPUptake(scenario);
  var fixedCost = 35500 + (scenario.annualCapacity - 500) * 10;
  if (scenario.deliveryMethod === "inperson") fixedCost += 5000;
  else if (scenario.deliveryMethod === "hybrid") fixedCost += 2500;
  if (scenario.levelTraining === "advanced") fixedCost += 3000;
  var variableCost = scenario.fee * trainees;
  var totalCost = fixedCost + variableCost;
  var sel = document.getElementById("qalyFETPSelect");
  var qVal = (sel && sel.value === "low") ? 0.01 : (sel && sel.value === "high") ? 0.08 : 0.05;
  var monetizedFull = trainees * qVal * 50000;
  var monetizedEffective = effectiveEnrollment * qVal * 50000;
  var netBFull = monetizedFull - totalCost;
  var netBEffective = monetizedEffective - totalCost;
  document.getElementById("estimatedCostDisplay").innerHTML = "$" + totalCost.toLocaleString();
  var container = document.getElementById("costsFETPResults");
  var econAdvice = (netBEffective < 0) ? "The programme may not be cost-effective. Consider revising features." :
                    (netBEffective < 50000) ? "This configuration shows modest benefits. Improvements could enhance cost-effectiveness." :
                                             "This configuration appears highly cost-effective.";
  container.innerHTML = "<div class='calculation-info'>" +
                        "<p><strong>Predicted Uptake:</strong> " + (computeFETPUptake(scenario) * 100).toFixed(2) + "%</p>" +
                        "<p><strong>Number of Trainees (Full Capacity):</strong> " + trainees + "</p>" +
                        "<p><strong>Potential Effective Enrollment:</strong> " + Math.round(effectiveEnrollment) + "</p>" +
                        "<p><strong>Total Training Cost:</strong> $" + totalCost.toFixed(2) + "</p>" +
                        "<p><strong>Monetised Benefits (Full Capacity):</strong> $" + monetizedFull.toLocaleString() + "</p>" +
                        "<p><strong>Monetised Benefits (Effective Enrollment):</strong> $" + monetizedEffective.toLocaleString() + "</p>" +
                        "<p><strong>Net Benefit (Full Capacity):</strong> $" + netBFull.toLocaleString() + "</p>" +
                        "<p><strong>Net Benefit (Effective Enrollment):</strong> $" + netBEffective.toLocaleString() + "</p>" +
                        "<p><em>Policy Recommendation:</em> " + econAdvice + "</p>" +
                        "</div>";
}

/* Render Cost-Benefit Analysis Chart */
function renderCostBenefitChart() {
  var scenario = buildFETPScenario();
  if (!scenario) return;
  var trainees = scenario.annualCapacity;
  var effectiveEnrollment = trainees * computeFETPUptake(scenario);
  var fixedCost = 35500 + (scenario.annualCapacity - 500) * 10;
  if (scenario.deliveryMethod === "inperson") fixedCost += 5000;
  else if (scenario.deliveryMethod === "hybrid") fixedCost += 2500;
  if (scenario.levelTraining === "advanced") fixedCost += 3000;
  var variableCost = scenario.fee * trainees;
  var totalCost = fixedCost + variableCost;
  var sel = document.getElementById("qalyFETPSelect");
  var qVal = (sel && sel.value === "low") ? 0.01 : (sel && sel.value === "high") ? 0.08 : 0.05;
  var monetizedEffective = effectiveEnrollment * qVal * 50000;
  var netBEffective = monetizedEffective - totalCost;
  var ctx = document.getElementById("costBenefitChart").getContext("2d");
  if (costBenefitChart) costBenefitChart.destroy();
  costBenefitChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Total Cost", "Monetised Benefits (Effective)", "Net Benefit (Effective)"],
      datasets: [{
        label: "USD",
        data: [totalCost, monetizedEffective, netBEffective],
        backgroundColor: ["#e74c3c", "#27ae60", "#f1c40f"]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 1000 },
      plugins: { 
        title: { display: true, text: "Cost-Benefit Analysis", font: { size: 16 } },
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

/* Render Leaflet Map */
function renderMap() {
  if (!leafletMap) {
    leafletMap = L.map('mapContainer').setView([20.5937, 78.9629], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(leafletMap);
    L.marker([28.6139, 77.2090]).addTo(leafletMap).bindPopup('New Delhi - State Capital');
    L.marker([19.0760, 72.8777]).addTo(leafletMap).bindPopup('Mumbai - Single Central Hub');
    L.marker([13.0827, 80.2707]).addTo(leafletMap).bindPopup('Chennai - Zonal Regional Center');
    L.marker([22.5726, 88.3639]).addTo(leafletMap).bindPopup('Kolkata - Decentralized Site');
  } else {
    leafletMap.invalidateSize();
  }
}

/* Scenario Saving & PDF Export */
var savedFETPScenarios = [];
function saveFETPScenario() {
  var sc = buildFETPScenario();
  if (!sc) { alert("Please select all inputs before saving a scenario."); return; }
  var fraction = computeFETPUptake(sc);
  var pct = fraction * 100;
  sc.uptake = pct.toFixed(2);
  var netB = (pct * 1000).toFixed(2);
  sc.netBenefit = netB;
  sc.name = "Scenario " + (savedFETPScenarios.length + 1);
  savedFETPScenarios.push(sc);
  var tb = document.querySelector("#FETPScenarioTable tbody");
  var row = document.createElement("tr");
  row.innerHTML = "<td>" + sc.name + "</td>" +
                  "<td>" + sc.levelTraining + "</td>" +
                  "<td>" + sc.trainingModel + "</td>" +
                  "<td>" + sc.deliveryMethod + "</td>" +
                  "<td>" + sc.trainingSites + "</td>" +
                  "<td>" + sc.annualCapacity + "</td>" +
                  "<td>$" + sc.stipendAmount + "</td>" +
                  "<td>$" + sc.fee + "</td>" +
                  "<td>" + sc.uptake + "%</td>" +
                  "<td>$" + sc.netBenefit + "</td>";
  tb.appendChild(row);
  alert('"' + sc.name + '" saved successfully.');
}

function exportFETPComparison() {
  if (!savedFETPScenarios.length) { alert("No saved scenarios available."); return; }
  var jsPDF = window.jspdf.jsPDF;
  var doc = new jsPDF({ unit: "mm", format: "a4" });
  var yPos = 15;
  doc.setFontSize(16);
  doc.text("FETP Scenarios Comparison", 105, yPos, { align: "center" });
  yPos += 10;
  savedFETPScenarios.forEach(function(sc, idx) {
    if (yPos + 60 > doc.internal.pageSize.getHeight() - 15) { doc.addPage(); yPos = 15; }
    doc.setFontSize(14);
    doc.text("Scenario " + (idx + 1) + ": " + sc.name, 15, yPos);
    yPos += 7;
    doc.setFontSize(12);
    doc.text("Level: " + sc.levelTraining, 15, yPos); yPos += 5;
    doc.text("Model: " + sc.trainingModel, 15, yPos); yPos += 5;
    doc.text("Delivery: " + sc.deliveryMethod, 15, yPos); yPos += 5;
    doc.text("Sites: " + sc.trainingSites, 15, yPos); yPos += 5;
    doc.text("Capacity: " + sc.annualCapacity, 15, yPos); yPos += 5;
    doc.text("Stipend: $" + sc.stipendAmount, 15, yPos); yPos += 5;
    doc.text("Fee: $" + sc.fee, 15, yPos); yPos += 5;
    doc.text("Adoption: " + sc.uptake + "%, Net Benefit: $" + sc.netBenefit, 15, yPos);
    yPos += 10;
  });
  doc.save("FETPScenarios_Comparison.pdf");
}

function exportIndividualScenario() {
  var input = prompt("Enter the scenario number to export:");
  var index = parseInt(input, 10);
  if (isNaN(index) || index < 1 || index > savedFETPScenarios.length) {
    alert("Invalid scenario number.");
    return;
  }
  var scenario = savedFETPScenarios[index - 1];
  var jsPDF = window.jspdf.jsPDF;
  var doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFontSize(16);
  doc.text("Scenario " + index + ": " + scenario.name, 15, 20);
  doc.setFontSize(12);
  doc.text("Level: " + scenario.levelTraining, 15, 30);
  doc.text("Model: " + scenario.trainingModel, 15, 40);
  doc.text("Delivery: " + scenario.deliveryMethod, 15, 50);
  doc.text("Sites: " + scenario.trainingSites, 15, 60);
  doc.text("Capacity: " + scenario.annualCapacity, 15, 70);
  doc.text("Stipend: $" + scenario.stipendAmount, 15, 80);
  doc.text("Fee: $" + scenario.fee, 15, 90);
  doc.text("Adoption Likelihood: " + scenario.uptake + "%", 15, 100);
  doc.text("Net Benefit: $" + scenario.netBenefit, 15, 110);
  doc.save("Scenario_" + index + ".pdf");
}

/* Toggle Cost Breakdown */
function toggleCostAccordion() {
  var elem = document.getElementById("detailedCostBreakdown");
  elem.style.display = (elem.style.display === "block") ? "none" : "block";
}

/* Toggle Benefits Explanation */
function toggleFETPBenefitsAnalysis() {
  var elem = document.getElementById("detailedFETPBenefitsAnalysis");
  elem.style.display = (elem.style.display === "block") ? "none" : "block";
}

/* Render Cost-Benefit Analysis Chart */
var costBenefitChart = null;
function renderCostBenefitChart() {
  var scenario = buildFETPScenario();
  if (!scenario) return;
  var trainees = scenario.annualCapacity;
  var effectiveEnrollment = trainees * computeFETPUptake(scenario);
  var fixedCost = 35500 + (scenario.annualCapacity - 500) * 10;
  if (scenario.deliveryMethod === "inperson") fixedCost += 5000;
  else if (scenario.deliveryMethod === "hybrid") fixedCost += 2500;
  if (scenario.levelTraining === "advanced") fixedCost += 3000;
  var variableCost = scenario.fee * trainees;
  var totalCost = fixedCost + variableCost;
  var sel = document.getElementById("qalyFETPSelect");
  var qVal = (sel && sel.value === "low") ? 0.01 : (sel && sel.value === "high") ? 0.08 : 0.05;
  var monetizedEffective = effectiveEnrollment * qVal * 50000;
  var netBEffective = monetizedEffective - totalCost;
  var ctx = document.getElementById("costBenefitChart").getContext("2d");
  if (costBenefitChart) costBenefitChart.destroy();
  costBenefitChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Total Cost", "Monetised Benefits (Effective)", "Net Benefit (Effective)"],
      datasets: [{
        label: "USD",
        data: [totalCost, monetizedEffective, netBEffective],
        backgroundColor: ["#e74c3c", "#27ae60", "#f1c40f"]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 1000 },
      plugins: { 
        title: { display: true, text: "Cost-Benefit Analysis", font: { size: 16 } },
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}
