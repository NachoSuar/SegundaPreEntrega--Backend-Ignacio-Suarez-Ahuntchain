import express from "express";
import { engine } from 'express-handlebars';
import mongoose from "mongoose";
import http from 'http';
import { Server } from 'socket.io'; 
import cartsRouter from "./routes/carts.route.js";
import Cart from './dao/models/cart.schema.js';
import prodsRouter from './routes/products.route.js';
import session from "express-session";
import cookieParser from "cookie-parser";
import MongoStore from "connect-mongo";
import sessionsRouter from './routes/session.js';
import viewRouter from "./routes/views.js"
import UsersDAO from "./dao/users.dao.js";
import passport from "passport";
import initializePassport from "./config/passport.config.js";
import config from "./config/config.js";
import generateMockProducts from "./mocking/mocking.js"; // Importa la función para generar productos de prueba

// Función para validar ObjectId
function isValidObjectId(id) {
    return /^[0-9a-fA-F]{24}$/.test(id);
}
initializePassport();

const app = express();
const server = http.createServer(app);
const io = new Server(server); 

// View engine
app.engine('handlebars', engine());
app.set('view engine', 'handlebars');
app.set('views', './views');

// Public folder
app.use(express.static('public'));

// Middlewares request
app.use(express.json());
app.use(express.urlencoded({extended:true}));

app.use(cookieParser());
app.use(session({
    store:MongoStore.create({
        mongoUrl:config.mongoDB.url,
        ttl: config.session.ttl,
    }),
    secret: config.session.secret,
    resave: true,
    saveUninitialized: true
}));

app.use("/api/sessions", sessionsRouter);
app.use("/", viewRouter);

// Middleware global para todas las rutas
app.use(async (req, res, next) => {
    if (req.session.user) {
        res.locals.user = await UsersDAO.getUserByID(req.session.user);
    } else {
        res.locals.user = null;
    }
    next();
});

app.use(passport.initialize());
app.use(passport.session());

// Router productos
app.use("/products", prodsRouter);

// Router Carts
app.use("/carts", cartsRouter);

// Nueva ruta para eliminar productos
app.get("/products/remove", (req, res) => {
    console.log('Intentando renderizar la vista remove-product');

    try {
        res.render('remove-product');
        console.log('Vista remove-product renderizada con éxito');
    } catch (error) {
        console.error('Error al renderizar la vista remove-product:', error);
        res.status(500).send('Error interno del servidor');
    }
});

// modelo del carrito
app.get('/mostrar_carrito', async (req, res) => {
    try {
      const carrito = await Cart.findOne({ });
      res.json(carrito);
    } catch (error) {
      console.error(error);
      res.status(500).send('Error al obtener el carrito');
    }
});

// Ruta para el endpoint /mockingproducts
app.get('/mockingproducts', async (req, res) => {
    console.log('Se ha llamado a la ruta /mockingproducts');
    try {
        const mockProducts = generateMockProducts(100); // Genera 100 productos de prueba
        res.json(mockProducts); // Devuelve los productos de prueba en formato JSON
    } catch (error) {
        console.error('Error al generar productos de prueba:', error);
        res.status(500).send('Error interno del servidor');
    }
});

// Home del sitio
app.get("/", (req, res) => {
    res.redirect("/home");
});

app.get("/home", (req, res) => {
    res.render("home");
});

app.get("/ping", (req, res) => {
    res.send("Pong!");
});

app.get("/chat", (req, res) => {
    res.render("chat");
});

// Página error 404
app.use((req, res, next) => {
    res.render("404");
});

// Manejo de conexiones de socket
io.on('connection', (socket) => {
    console.log('Usuario conectado al chat');

    // Lógica para manejar mensajes de chat
    socket.on('chat message', (msg) => {
        io.emit('chat message', msg); // Envia el mensaje a todos los usuarios conectados
    });

    // Lógica para manejar desconexiones de usuarios
    socket.on('disconnect', () => {
        console.log('Usuario desconectado del chat');
    });
});



// Conexión MongoDB
mongoose.connect(config.mongoDB.url);

mongoose.connection.on('error', err => {
    console.error('MongoDB Connection Error:', err);
});

// Iniciar el servidor con Socket.IO
server.listen(3000, () => {
    console.log("App listening on port 3000");
});

export { io };
