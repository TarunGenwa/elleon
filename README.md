# Elleon
A Graph QL framework for Node.js and the most popular orm and odm i.e. sequelize and mongoose.


## Getting Started
```angular2html
npm i elleon
```

## Example
#### Apollo Server 1
```angular2html
const { graphqlExpress, graphiqlExpress } = require('apollo-server-express');


const models = require('./models');)
let elleon = require('elleon');

const elleonInstance = new elleon({logging:false, sequelize:{models:models} , resolver_path:__dirname+'/resolvers', });
let schema = elleonInstance.makeExecuteableSchema();
let graph_app = graphqlExpress({
                    schema: schema,
                    context: {
                      models,
                  }),
                  
app.use(
 '/graphql',
  bodyParser.json(),
  graph_app,
);
```

#### Apollo Server 2
```angular2html
const { ApolloServer } = require('apollo-server-express');
const cors          = require('cors');
const models        = require('./models');
const elleon        = require('elleon');

const app = express();
app.use(cors('*'));


const elleonInstance = new elleon({logging:false, sequelize:{models:models} , resolver_path:__dirname+'/resolvers', });
const typesResolvers = elleonInstance.getTypeDefsAndResolvers();

const server = new ApolloServer({ typeDefs:typesResolvers.typeDefs, resolvers:typesResolvers.resolvers });
server.applyMiddleware({ app });

let port = 3000;
app.listen({ port }, () =>
    console.log(`Server ready at http://localhost:${port}${server.graphqlPath}`),
);
```
# Resolvers
Make a directory, e.g. resolvers. We now group each file by function instead of type of resolver. 
So lets say we have user functionality. we would make a file called user.resolver.js
In it we would include:
```angular2html

module.exports.getUser = {
  type: 'Query',
  arguments: false,
  returnType: 'User',
  resolver: () => {
    return {
        email: 'test@test.com',
        name: 'john doe',
    }
  }
};

module.exports.loginUser = {
  type: 'Query',
  arguments: '(email: String, password: String)',
  returnType: 'User',
  resolver: (data, args) => {
    console.log(data, args);
    return {
        id: 2,
        email:'test@test.com',
    }
  },
};
```

The **returnType** value could be
```angular2html
returnType: 'User'
returnType: '[User]'
returnType: ['User']
returnType: ()=>this.models.User.schemaTypeName
returnType: ()=>[this.models.User.schemaTypeName]
```

## Built In CRUD functionality
We have 5 boolean options
```angular2html
getSingleQuery
getAllQuery
createMutation
updateMutation
deleteMutation
```


```angular2html
const elleonInstance = new elleon({
    sequelize:{models:models}, 
    resolver_path:__dirname+'/resolvers', 
    getSingleQuery: true,
    createMutation: true,
});

```

## Example Sequelize Schema
contains custom options for graphql schema

```angular2html
const bcrypt 			= require('bcrypt');
const bcrypt_p 			= require('bcrypt-promise');
const {to}              = require('await-to-js');

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('user', {
    email: {
      type: DataTypes.STRING,
      unique: true,
    },
    password: {
      type:DataTypes.STRING,
      graphql: { getQueryAttribute:false, getQueryInput:false },
    },
  });

  User.beforeSave(async (user, options) => {
      let err;
      if (user.changed('password')){
          let salt, hash
          [err, salt] = await to(bcrypt.genSalt(10));
          if(err) TE(err.message, true);

          [err, hash] = await to(bcrypt.hash(user.password, salt));
          if(err) TE(err.message, true);

          user.password = hash;
      }
  });

  User.prototype.comparePassword = async function (pw) {
      let err, pass
      if(!this.password) TE('password not set');

      [err, pass] = await to(bcrypt_p.compare(pw, this.password));
      if(err) TE(err);

      if(!pass) TE('invalid password');

      return this;
  };


  User.graphqlOptions = {
      addAttributes:{
          jwt:{schemaType:'String', relation:'one'}//options one or many
      },
  };

  return User;
};

```