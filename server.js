require('dotenv').config();
const express = require('express')
const app = express()
const server = require('http').Server(app)
const io = require('socket.io')(server)
const { ExpressPeerServer } = require('peer');
const peerServer = ExpressPeerServer(server, {
  debug: true
});
const { v4: uuidV4 } = require('uuid')
const bodyParser  = require("body-parser")
const mongoose    = require("mongoose")
const User        = require("./models/user")
const bcrypt      = require('bcrypt')
const session     = require('express-session')
const flash       = require('connect-flash')

app.use('/peerjs', peerServer);
app.set('view engine', 'ejs')

//=====================================================

//database connection
const uri = process.env.ATLAS_URI;
mongoose.connect(uri, { useNewUrlParser: true, useCreateIndex: true , useUnifiedTopology: true }
);
const connection = mongoose.connection;
connection.once('open', () => {
  console.log("MongoDB database connection established successfully");
})
//===================================================

app.use(express.urlencoded({extended: true}));
app.use(session({ secret : 'notgoodsecret'}))
app.use(flash());
app.use(express.static('public'))
//app.use(express.static(__dirname + "/public"));

app.use(function(req, res, next){
  res.locals.currentUser = req.session.username;
  res.locals.error = req.flash("error");
  res.locals.success = req.flash("success");
  next();
});
//=====================================================

app.use(function(req, res, next){
  res.locals.currentUser = req.session.username;
  res.locals.error = req.flash("error");
  res.locals.success = req.flash("success");
  next();
});
//=====================================================

const isLogin = (req , res , next)=>{
  //console.log("REQ.USER..." , req.session.username)
  if(!req.session.user_id){
      req.flash('error' , 'You must be signed in first')
      return res.redirect('/login')
  }
  next();
}

//=====================================================
app.get('/' , (req ,res) =>{
    
  res.render('landing');
})

//==========================================================

app.get('/register' , (req ,res) =>{
  res.render('register')
})
app.post('/register' , async(req ,res) =>{
  const {password , username, confirmPassword} =req.body;
  if(password != confirmPassword){
    //req.flash('error' , 'confirm your password')
    res.redirect('/register');
  }
  const hash = await bcrypt.hash(password , 12);
  const user = new User({
      username,
      password: hash
  })
  await user.save();
  req.session.user_id = user._id;
  req.session.username = username;
  
  res.redirect('/');
  
})

app.get('/login' , (req ,res) =>{
  res.render('login')
})

app.post('/login' ,async (req ,res) =>{
  const { username , password } = req.body;
  const user = await User.findOne({username});
  const validPassword = await bcrypt.compare(password ,user.password);
  if(validPassword){
      req.session.user_id = user._id;
      req.session.username = username;
      req.flash('success' ,'succcfully login');
      res.redirect('/')
  }else{
      res.redirect('/login')
  }
})


app.get('/logout' , (req ,res) =>{
  //req.session.user_id =null;
  req.session.destroy();
  res.redirect('/login');
})
//=========================================================

const exportUsersToExcel = require('./exportService');

const users = [

];

const workSheetColumnName = [
    
    
    "UserId",
    "Name",
    "Login Time",
    "logout Time"
    
   
]
const workSheetName = 'Users';
const filePath = './outputFiles/excel-from-js.xlsx';

//========================================================

var host=null;
var currUsername=null;
//=========================================================

app.get('/joinroom', (req, res) => {
  res.render('Room/joinRoom', { userName: req.session.username })
})

app.post('/joinroom',(req, res) => {
  const {roomId} =req.body;
  currUsername=req.session.username;
  res.redirect("/"+roomId)
})

app.get('/createroom', (req, res) => {
 host= req.session.username;
 currUsername=req.session.username;
  res.redirect(`/${uuidV4()}`)
})


app.get('/:room', (req, res) => {

  res.render('room', { roomId: req.params.room })
})

io.on('connection', socket => {
  socket.on('join-room', (roomId, userId) => {
    socket.join(roomId)
    
     var data ={
      name: currUsername,
      userId:userId,
      loginTime:new Date().toLocaleTimeString(),
      logoutTime:""
    }

    users.push(data);
    console.log(users);
    console.log(data);
    socket.to(roomId).broadcast.emit('user-connected', userId)

    socket.on('disconnect', () => {
      console.log(userId);
      for(var i=0;i<users.length ;i++){
        if(users[i].userId===userId){
          users[i].logoutTime= new Date().toLocaleTimeString();
          exportUsersToExcel(users, workSheetColumnName, workSheetName, filePath);
          socket.to(roomId).broadcast.emit('user-disconnected', userId)
          break;
        }
      }
    })
  })
})
//===================================================


//======================================================
server.listen(3000)