# ⚡ ChatFlow - Déploiement en 3 Étapes (10 min)

## 🎯 L'essentiel SEULEMENT

Vous avez besoin de :
1. **6 fichiers** (déjà créés ✅)
2. **MongoDB gratuit** (5 min)
3. **Railway gratuit** (5 min)

---

## STEP 1️⃣ : GitHub (5 min)

```bash
# Terminal
mkdir chatflow && cd chatflow

# Copier 6 fichiers dans ce dossier :
# - index.html
# - server.js
# - models.js
# - routes.js
# - package.json
# - .env.example

# Committer
git init
git add .
git commit -m "ChatFlow"
git branch -M main

# Créer un repo vide sur github.com/new
# Puis pousser :
git remote add origin https://github.com/USERNAME/chatflow.git
git push -u origin main
```

✅ Code sur GitHub

---

## STEP 2️⃣ : MongoDB (2 min)

1. https://www.mongodb.com/cloud/atlas
2. Sign up → Create Free Cluster
3. **Connect** → **Driver** → **Node.js**
4. Copier l'URI :
```
mongodb+srv://user:password@cluster.mongodb.net/chatflow
```

⚠️ Remplacez `user:password` par vos identifiants

✅ URL MongoDB copiée

---

## STEP 3️⃣ : Railway (3 min)

### A. Créer et déployer

1. https://railway.app → Sign up (GitHub login)
2. **+ New Project** → **Deploy from GitHub**
3. Sélectionnez `chatflow` repo
4. **Deploy** ✅ Railway lance le build

### B. Configurer les variables

Dans Railway, allez **Variables** et ajoutez :

```
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/chatflow
JWT_SECRET=super-secret-key-change-me-in-prod
NODE_ENV=production
```

Railway redéploie automatiquement 🚀

### C. Copier l'URL

1. **Settings** → **Public URL**
2. Copiez : `https://chatflow-production.railway.app`

### D. Mettre à jour le frontend

Fichier `index.html` ligne ~350 :
```javascript
const SERVER_URL = 'https://votre-url-railway.app';
```

Pushez :
```bash
git add index.html
git commit -m "Update URL"
git push
```

Railway redéploie 🎉

---

## ✅ Vous êtes en ligne!

**URL finale :**
```
https://votre-url-railway.app/index.html
```

### Tester :

1. Ouvrir dans **2 navigateurs différents**
2. Nom: Alice / Password: test123
3. Nom: Bob / Password: test123
4. **Chat en temps réel** 💬

---

## 💡 Tips

- N'oubliez pas de remplacer `MONGODB_URI` par votre vrai lien
- N'oubliez pas de remplacer `SERVER_URL` dans `index.html`
- Attendez 2-3 min que Railway finisse le déploiement

---

**Ça y est! Vous avez une app de chat en ligne! 🎉**

Partagez le lien avec vos amis!
