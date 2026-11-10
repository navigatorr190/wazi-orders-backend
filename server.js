require('dotenv').config();
const express = require('express');
const app = express();

// On permet à l'application de lire le format JSON
app.use(express.json());

// 1. Route de test pour voir si le serveur est en ligne
app.get('/', (req, res) => {
    res.send('Le serveur WAZI ORDERS est en ligne et fonctionne !');
});

// 2. Route pour recevoir les commandes de Thinker COD
app.post('/webhooks/thinker-cod', (req, res) => {
    const commande = req.body;
    console.log("Nouvelle commande reçue de Thinker COD :", commande);
    
    // Plus tard, nous ajouterons ici la logique de détection de pays 
    // et l'envoi vers Shopify.

    // On confirme la réception
    res.status(200).send('Commande reçue');
});

// 3. Route pour les webhooks Shopify (nouvelles commandes)
app.post('/webhooks/shopify/orders', (req, res) => {
    console.log("Notification de commande Shopify reçue :", req.body);
    
    // Ici, nous traiterons les commandes venant de Shopify
    
    res.status(200).send('Webhook Shopify reçu');
});

// Démarrage du serveur sur le port fourni par Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});
