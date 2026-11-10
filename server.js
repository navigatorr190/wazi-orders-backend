require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();

// Configuration pour lire les données JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Autoriser les appels (CORS)
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// Afficher les fichiers statiques (comme formulaire.html)
app.use(express.static(path.join(__dirname)));

// Route racine : Affiche un message simple
app.get('/', (req, res) => {
    res.send('Le serveur WAZI ORDERS est en ligne. Allez sur /formulaire.html pour voir le formulaire.');
});

// Route pour recevoir la commande du formulaire
app.post('/commande', async (req, res) => {
    const { produit, quantite, prix_total, devise, prenom, nom, telephone, pays, adresse } = req.body;
    
    console.log("=== NOUVELLE COMMANDE REÇUE ===");
    console.log(`Client : ${prenom} ${nom}`);
    console.log(`Téléphone : ${telephone}`);
    console.log(`Produit : ${produit} x${quantite}`);
    console.log(`Prix : ${prix_total} ${devise}`);
    console.log(`Pays : ${pays}`);
    console.log(`Adresse : ${adresse}`);
    console.log("===============================");

    try {
        // 1. Vérification des variables d'environnement
        if (!process.env.SHOPIFY_STORE_URL || !process.env.SHOPIFY_CLIENT_SECRET) {
            throw new Error("Variables d'environnement Shopify manquantes sur Render.");
        }

        // 2. Préparation des données pour l'API Shopify
        const shopifyOrderData = {
            order: {
                line_items: [
                    {
                        title: produit,
                        quantity: parseInt(quantite),
                        price: parseFloat(prix_total).toString()
                    }
                ],
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
                financial_status: "pending", // Statut : Paiement en attente (COD)
                tags: "WAZI COD",
                note: `Commande via formulaire COD. Devise : ${devise}.`,
                currency: devise === "GNF" ? "GNF" : "XOF"
            }
        };

        // 3. Appel à l'API Shopify
        const shopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/orders.json`;
        
        const response = await axios.post(shopifyUrl, shopifyOrderData, {
            headers: {
                'X-Shopify-Access-Token': process.env.SHOPIFY_CLIENT_SECRET,
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

// Démarrage du serveur
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});
