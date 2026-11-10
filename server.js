async function detectCountry() {
    try {
        // On essaie l'API principale
        const response = await fetch('https://ipapi.co/json/');
        if (response.ok) {
            const data = await response.json();
            applyCountryConfig(data.country_code);
            return; 
        }
    } catch (error) {
        console.log("API principale bloquée, tentative avec l'API de secours...");
    }

    try {
        // API de secours
        const response = await fetch('https://api.country.is/');
        if (response.ok) {
            const data = await response.json();
            applyCountryConfig(data.country);
            return;
        }
    } catch (error) {
        console.log("API de secours bloquée aussi. Utilisation de la Guinée par défaut.");
    }

    // Si tout échoue
    applyCountryConfig("GN");
}

// Fonction pour appliquer la configuration du pays (Devise + Indicatif)
function applyCountryConfig(countryCode) {
    const countryConfig = {
        "GN": { name: "Guinée", dial: "+224", devise: "GNF", rate: 1 },
        "SN": { name: "Sénégal", dial: "+221", devise: "FCFA", rate: 0.066 },
        "CI": { name: "Côte d'Ivoire", dial: "+225", devise: "FCFA", rate: 0.066 },
        "ML": { name: "Mali", dial: "+223", devise: "FCFA", rate: 0.066 },
        "FR": { name: "France", dial: "+33", devise: "EUR", rate: 0.0001 },
        "US": { name: "États-Unis", dial: "+1", devise: "USD", rate: 0.0001 },
        "CA": { name: "Canada", dial: "+1", devise: "CAD", rate: 0.0001 }
    };

    // Si le pays est reconnu, on l'applique, sinon on garde la Guinée
    const config = countryConfig[countryCode] || countryConfig["GN"];
    
    // Mise à jour des variables globales
    detectedCountry = config.name;
    detectedDevise = config.devise;
    conversionRate = config.rate;
    
    // ⚠️ C'EST ICI QUE L'INDICATIF EST MIS À JOUR ⚠️
    const indicatifInput = document.getElementById('indicatif');
    if (indicatifInput) {
        indicatifInput.value = config.dial;
    }
    
    // Rafraîchir les prix des bundles
    renderBundles();
}
