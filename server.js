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
    console.log(`Prix : ${prix_total} ${devise}`);

    try {
        const shopUrl = process.env.SHOPIFY_STORE_URL;
        const clientId = process.env.SHOPIFY_CLIENT_ID;
        const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

        if (!shopUrl || !clientId || !clientSecret) {
            throw new Error("Variables d'environnement manquantes sur Render.");
        }

        // --- ÉTAPE 1 : OBTENIR LE TOKEN D'ACCÈS ---
        console.log("Demande d'un nouveau token d'accès à Shopify...");
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
        console.log("Token obtenu avec succès !");

        // --- ÉTAPE 2 : CRÉER LA COMMANDE ---
        const shopifyOrderData = {
            order: {
                line_items: [{
                    title: produit,
                    quantity: parseInt(quantite),
                    price: parseFloat(prix_total).toString()
                }],
                customer: {
                    first_name: prenom,
                    last_name: nom,
                    phone: telephone
                },
                shipping_address: {
                    first_name: prenom,
                    last_name: nom,
                    address1: adresse,
                    phone: telephone,
                    country: pays
                },
                financial_status: "pending",
                tags: "WAZI COD",
                note: `Commande via formulaire COD. Devise : ${devise}.`,
                currency: devise === "GNF" ? "GNF" : "XOF"
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
        res.status(200).json({ success: true, message: "Commande enregistrée dans Shopify !" });

    } catch (error) {
        console.error("❌ Erreur lors de la création de la commande Shopify :");
        if (error.response) {
            console.error("Détails de l'erreur Shopify :", error.response.data);
        } else {
            console.error("Message d'erreur :", error.message);
        }
        res.status(500).json({ success: false, message: "Erreur lors de la création de la commande." });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});
