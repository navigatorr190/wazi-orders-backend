async function detectCountry() {
    // 1. Essayer de récupérer le pays avec l'API principale
    try {
        const response = await fetch('https://ipapi.co/json/');
        if (response.ok) {
            const data = await response.json();
            applyCountryConfig(data.country_code);
            return; // Si ça marche, on s'arrête là
        }
    } catch (error) {
        console.log("API principale bloquée, tentative avec l'API de secours...");
    }

    // 2. Si l'API principale échoue (VPN, bloqueur), on utilise une API de secours
    try {
        const response = await fetch('https://api.country.is/');
        if (response.ok) {
            const data = await response.json();
            applyCountryConfig(data.country);
            return;
        }
    } catch (error) {
        console.log("API de secours bloquée aussi. Utilisation de la Guinée par défaut.");
    }

    // 3. Si tout échoue, on affiche la Guinée par défaut
    applyCountryConfig("GN");
}

// Fonction pour appliquer la configuration du pays
function applyCountryConfig(countryCode) {
    const countryConfig = {
        "GN": { name: "Guinée", dial: "+224", devise: "GNF", rate: 1 },
        "SN": { name: "Sénégal", dial: "+221", devise: "FCFA", rate: 0.066 },
        "CI": { name: "Côte d'Ivoire", dial: "+225", devise: "FCFA", rate: 0.066 },
        "ML": { name: "Mali", dial: "+223", devise: "FCFA", rate: 0.066 },
        "FR": { name: "France", dial: "+33", devise: "EUR", rate: 0.0001 },
        "US": { name: "États-Unis", dial: "+1", devise: "USD", rate: 0.0001 }
    };

    // Si le pays est reconnu, on met à jour, sinon on garde la Guinée
    const config = countryConfig[countryCode] || countryConfig["GN"];
    
    detectedCountry = config.name;
    detectedDevise = config.devise;
    conversionRate = config.rate;
    
    // Mettre à jour l'indicatif téléphonique
    document.getElementById('indicatif').value = config.dial;
    
    // Rafraîchir les prix
    renderBundles();
}
