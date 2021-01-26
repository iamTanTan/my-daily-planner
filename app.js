require('dotenv').config()
const express = require('express');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
const passportLocalMongoose = require('passport-local-mongoose');
const findOrCreate = require('mongoose-findorcreate');

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
    extended: true
}));
app.set('trust proxy', 1) // trust first proxy
app.use(session({
    secret: 'oiargd34borea6SOD45dgs',
    resave: false,
    saveUninitialized: false,
    //   cookie: { secure: true }
}));
app.use(passport.initialize());
app.use(passport.session());


mongoose.connect('mongodb://localhost:27017/userDB', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});
mongoose.set('useCreateIndex', true);

// Schema for individual items on each list
const itemSchema = {
    name: String
  };
  
  const Item = mongoose.model("Item", itemSchema);
  
  // Create initial items for given list
  
  const item1 = new Item({
    name: "Welcome to the todolist!"
  });
  const item2 = new Item({
    name: "Hit + to add more items."
  });
  const item3 = new Item({
    name: "<-- Hit this to delete an item."
  });
  
  const defaultItems = [item1, item2, item3];
  
  //  Schema for all lists
  const listSchema = {
    name: String,
    items: [itemSchema]
  }
  
  const List = mongoose.model("List", listSchema);
  

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    List: [listSchema]
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = mongoose.model('User', userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
    done(null, user);
});

passport.deserializeUser(function (user, done) {
    done(null, user);
});

passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "http://localhost:3000/auth/google/secrets"
    },
    function (accessToken, refreshToken, profile, done) {
        console.log(profile);
        User.findOrCreate({
            googleId: profile.id
        }, function (err, user) {
            return done(err, user);
        });
    }
));

/*************************************************************************/
app.get("/", (req, res) => {
    res.render("home");
})

app.get('/auth/google',
    passport.authenticate('google', {
        scope: ['https://www.googleapis.com/auth/plus.login']
    }));

app.get('/auth/google/secrets',
    passport.authenticate('google', {
        failureRedirect: '/login'
    }),
    function (req, res) {
        res.redirect('/todo');
    });

app.get("/login", (req, res) => {
    res.render("login");
})

app.get('/logout', function (req, res) {
    req.logout();
    res.redirect('/');
});

app.get("/register", (req, res) => {
    res.render("register");
})

app.get("/secrets", (req, res) => {
    if (req.isAuthenticated) {
        res.render("todo");
    } else {
        res.redirect("/login");
    }
})

// app.get("/submit", (req, res) => {
//     if (req.isAuthenticated) {
//         res.render("submit");
//     } else {
//         res.redirect("/login");
//     }
// })

app.post('/register', (req, res) => {
    console.log('registering user');
    User.register({
        username: req.body.username
    }, req.body.password, function (err) {
        if (err) {
            console.log('error while user register!', err);
            res.redirect("/register");
        } else {
            passport.authenticate("local")(req, res, function () {
                res.redirect("/todo");
            })
        }
    })
});

app.post("/login", (req, res) => {
    const user = new User({
        username: req.body.username,
        password: req.body.password
    });

    req.logIn(user, (err) => {
        if (err) {
            console.log(err);
        } else {
            passport.authenticate("local")(req, res, function () {
                res.redirect("/todo");
            })
        }
    })
});

// app.post("/submit", (req, res) => {
//     const submittedSecret = req.body.secret;

//     User.findById(req.user.id, (err, foundUser) => {
//         if(err){
//             console.log(err);
//         } else {
//             if(foundUser) {
//             foundUser.secret = submittedSecret;
//             foundUser.save(() => {
//                 res.redirect("/secrets")
//             })
//         }
//     }


//     })
// })

/*********************** Todo Routing *****************************/


// Routing for list
app.get("/todo", function (req, res) {


    Item.find({}, function (err, items) {

        if (items.length === 0) {
            Item.insertMany(defaultItems).then(() => {
                console.log("Data Inserted");
            }).catch((err) => {
                console.log(err);
            });
            res.redirect("/");
        } else {
            res.render("todo", {
                listTitle: "Today",
                newListItems: items
            });
        }

    });
});

// add items to list with corresponding list name
app.post("/todo", function (req, res) {

    const itemName = req.body.newItem;
    const listName = req.body.list;

    const anotherItem = new Item({
        name: itemName
    });

    if (listName === "Today") {
        anotherItem.save();
        res.redirect("/");
    } else {
        List.findOne({
            name: listName
        }, function (err, foundList) {
            if (err) {
                console.log(err);
            } else {
                foundList.items.push(anotherItem);
                foundList.save();
                res.redirect("/" + listName);
            }
        });
    }

});

// Deletes an item with check
app.post("/delete", (req, res) => {

    const checkedItemId = req.body.checkbox;
    const listName = req.body.listName;

    // Delete item from existing list
    if (listName === "Today") {
        Item.findByIdAndRemove(checkedItemId, (err) => {
            if (!err) {
                console.log("Delete successful!");
            }
        })
        res.redirect("/");
    } else {
        // Delete item from custom list
        List.findOneAndUpdate({
            name: listName
        }, {
            $pull: {
                items: {
                    _id: checkedItemId
                }
            }
        }, (err, foundlist) => {
            res.redirect("/" + listName);
        })
    }
});

// // Routing to create more custom Lists
// app.get("/:listName", (req, res) => {

//     const listName = _.capitalize(req.params.listName);

//     List.findOne({
//         name: listName
//     }, (err, foundList) => {
//         if (!err) {
//             if (!foundList) {
//                 //  Create a new List since one does not yet exist
//                 const list = new List({
//                     name: listName,
//                     items: defaultItems
//                 });

//                 list.save();
//                 // Reload
//                 res.redirect("/" + listName);
//             } else {
//                 // Render Existing List
//                 res.render("todo", {
//                     listTitle: foundList.name,
//                     newListItems: foundList.items
//                 });
//             }
//         }
//     });
// });
/******************************************************************* */

app.listen(3000, () => {
    console.log("Listening on port 3000");
})