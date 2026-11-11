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
    console.log(`Pays détecté : ${pays}`);
    console.log(`Adresse : ${adresse}`);

    try {
        const shopUrl = process.env.SHOPIFY_STORE_URL;
        const clientId = process.env.SHOPIFY_CLIENT_ID;
        const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

        if (!shopUrl || !clientId || !clientSecret) {
            throw new Error("Variables d'environnement manquantes sur Render.");
        }

        // 1. OBTENIR LE TOKEN
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

        // Nettoyer le numéro
        const cleanPhone = telephone.replace(/[^\d+]/g, '');

        // 2. CONVERSION DU PAYS EN CODE ISO (Obligatoire pour Shopify)
        // Si le pays n'est pas dans la liste, on met 'GN' par défaut
        const countryCodes = {
            "Guinée": "GN",
            "Sénégal": "SN",
            "Côte d'Ivoire": "CI",
            "Mali": "ML",
            "France": "FR",
            "Allemagne": "DE",
            "États-Unis": "US",
            "Canada": "CA",
            "Royaume-Uni": "GB"
        };
        const countryIso = countryCodes[pays] || "GN";

        // 3. CHERCHER LE CLIENT
        let customerId = null;
        try {
            const customerSearchUrl = `https://${shopUrl}/admin/api/2024-01/customers/search.json?query=phone:${encodeURIComponent(cleanPhone)}`;
            const searchResponse = await axios.get(customerSearchUrl, {
                headers: { 'X-Shopify-Access-Token': accessToken }
            });

            if (searchResponse.data.customers && searchResponse.data.customers.length > 0) {
                customerId = searchResponse.data.customers[0].id;
            }
        } catch (err) {
            console.log("Recherche client ignorée (nouveau client).");
        }

        // 4. CRÉER LA COMMANDE AVEC TOUTES LES INFOS
        const shopifyOrderData = {
            order: {
                line_items: [{
                    title: produit,
                    quantity: parseInt(quantite),
                    price: parseFloat(prix_total).toString()
                }],
                // Informations du client (Nom + Téléphone)
                ...(customerId ? { customer: { id: customerId } } : { 
                    customer: {
                        first_name: prenom,
                        last_name: nom,
                        phone: cleanPhone
                    }
                }),
                // Adresse de livraison complète
                shipping_address: {
                    first_name: prenom,
                    last_name: nom,
                    address1: adresse,
                    phone: cleanPhone,
                    country_code: countryIso, // CODE ISO OBLIGATOIRE
                    country_name: pays
                },
                // Informations de facturation (parfois nécessaire pour l'affichage)
                billing_address: {
                    first_name: prenom,
                    last_name: nom,
                    address1: adresse,
                    phone: cleanPhone,
                    country_code: countryIso,
                    country_name: pays
                },
                financial_status: "pending",
                tags: `WAZI COD, Pays: ${pays}, Devise: ${devise}`,
                // La note contient tout ce qu'il faut pour le livreur
                note: `📍 Pays : ${pays}\n🏠 Adresse : ${adresse}\n📞 Tél : ${telephone}\n💰 Montant : ${prix_total} ${devise}`,
                currency: devise === "GNF" ? "GNF" : "XOF",
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
