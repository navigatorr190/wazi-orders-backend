require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.send('Le serveur WAZI ORDERS est en ligne.');
});

app.post('/commande', async (req, res) => {
    const { produit, quantite, prix_total, devise, prenom, nom, telephone, pays, adresse } = req.body;
    
    console.log("=== NOUVELLE COMMANDE REÇUE ===");
    console.log(`Client : ${prenom} ${nom} (${telephone})`);
    console.log(`Produit : ${produit} x${quantite}`);
    console.log(`Prix total : ${prix_total} ${devise}`);
    console.log(`Pays détecté : ${pays}`);

    try {
        const shopUrl = process.env.SHOPIFY_STORE_URL;
        const clientId = process.env.SHOPIFY_CLIENT_ID;
        const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

        if (!shopUrl || !clientId || !clientSecret) {
            throw new Error("Variables d'environnement manquantes sur Render.");
        }

        const tokenResponse = await axios.post(
            `https://${shopUrl}/admin/oauth/access_token`,
            new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: clientId,
                client_secret: clientSecret
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const accessToken = tokenResponse.data.access_token;
        const cleanPhone = telephone.replace(/[^\d+]/g, '');

        // Définition des codes de devise pour Shopify
        let currencyCode = "GNF";
        if (devise === "XOF" || devise === "FCFA") currencyCode = "XOF";
        else if (devise === "EUR") currencyCode = "EUR";
        else if (devise === "USD") currencyCode = "USD";
        else if (devise === "GBP") currencyCode = "GBP";
        else if (devise === "CAD") currencyCode = "CAD";

        // Prix unitaire (pour Shopify)
        const pricePerItem = parseFloat(prix_total) / parseInt(quantite);

        const countryCodes = {
            "Guinée": "GN", "Sénégal": "SN", "Côte d'Ivoire": "CI", "Mali": "ML",
            "Bénin": "BJ", "Burkina Faso": "BF", "Guinée-Bissau": "GW", "Niger": "NE", "Togo": "TG",
            "France": "FR", "Allemagne": "DE", "Espagne": "ES", "États-Unis": "US",
            "Canada": "CA", "Royaume-Uni": "GB"
        };
        const countryIso = countryCodes[pays] || "GN";

        let customerId = null;
        try {
            const customerSearchUrl = `https://${shopUrl}/admin/api/2024-01/customers/search.json?query=phone:${encodeURIComponent(cleanPhone)}`;
            const searchResponse = await axios.get(customerSearchUrl, {
                headers: { 'X-Shopify-Access-Token': accessToken }
            });

            if (searchResponse.data.customers && searchResponse.data.customers.length > 0) {
                customerId = searchResponse.data.customers[0].id;
            }
        } catch (err) {}

        // --- CORRECTION ICI : GESTION DE LA DEVISE ET DU MONTANT ---
        // On calcule le montant en GNF pour la note (basé sur les taux que vous avez donnés)
        // 1 XOF = 14 GNF, 1 EUR/USD = 8000 GNF
        let priceInGNF = prix_total;
        if (currencyCode === "XOF") priceInGNF = prix_total * 14;
        else if (["EUR", "USD", "GBP", "CAD"].includes(currencyCode)) priceInGNF = prix_total * 8000;

        // Symbole de la devise
        let symbol = "";
        if (currencyCode === "USD" || currencyCode === "CAD") symbol = "$";
        else if (currencyCode === "EUR") symbol = "€";
        else if (currencyCode === "GBP") symbol = "£";
        else if (currencyCode === "XOF") symbol = "FCFA";
        else symbol = "GNF";

        const noteText = `📍 Pays : ${pays}\n🏠 Adresse : ${adresse}\n📞 Tél : ${telephone}\n💰 Montant client : ${prix_total} ${symbol} (${currencyCode})\n🔄 Équivalent GNF : ${Math.round(priceInGNF).toLocaleString('fr-FR')} GNF`;

        const shopifyOrderData = {
            order: {
                line_items: [{
                    title: produit,
                    quantity: parseInt(quantite),
                    price: pricePerItem.toString(),
                    // ON FORCE LA DEVISE ICI POUR QUE SHOPIFY COMPRENNE
                    price_set: {
                        shop_money: {
                            amount: pricePerItem.toString(),
                            currency_code: "GNF" // Shopify convertira automatiquement
                        },
                        presentment_money: {
                            amount: pricePerItem.toString(),
                            currency_code: currencyCode // La devise réelle du client
                        }
                    }
                }],
                ...(customerId ? { customer: { id: customerId } } : { 
                    customer: {
                        first_name: prenom,
                        last_name: nom,
                        phone: cleanPhone
                    }
                }),
                shipping_address: {
                    first_name: prenom,
                    last_name: nom,
                    address1: adresse,
                    phone: cleanPhone,
                    country_code: countryIso,
                    country_name: pays
                },
                billing_address: {
                    first_name: prenom,
                    last_name: nom,
                    address1: adresse,
                    phone: cleanPhone,
                    country_code: countryIso,
                    country_name: pays
                },
                financial_status: "pending",
                tags: `WAZI COD, Pays: ${pays}, Devise: ${currencyCode}`,
                note: noteText,
                // On force la devise de la commande
                currency: currencyCode,
                inventory_behaviour: "bypass"
            }
        };

        const shopifyUrl = `https://${shopUrl}/admin/api/2024-01/orders.json`;
        
        const response = await axios.post(shopifyUrl, shopifyOrderData, {
            headers: {
                'X-Shopify-Access-Token': accessToken,
                'Content-Type': 'application/json'
            }
        });

        console.log("✅ Commande créée avec succès dans Shopify ! ID:", response.data.order.id);
        console.log(`Montant : ${prix_total} ${currencyCode} (${Math.round(priceInGNF)} GNF)`);
        res.status(200).json({ success: true, message: "Commande enregistrée !" });

    } catch (error) {
        console.error("❌ Erreur Shopify :");
        if (error.response) {
            console.error(error.response.data);
        } else {
            console.error(error.message);
        }
        res.status(500).json({ success: false, message: "Erreur lors de la création." });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});
