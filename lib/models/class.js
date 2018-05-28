const util = require('../util');
const pluralize                                   = require('pluralize');

class Model {
    constructor(options){
        let defaults = {
            type: null,
            name: null,
            model: null,

            assosiations:null,
            attributes:null,

            queries:true,
            mutations:true,
            subscriptions:true,

            queryGetSingle:true,
            queryGetAll:true,

            mutationCreate:true,
            mutationUpdate:true,
            mutationDelete:true,

        };
        options = Object.assign({}, defaults, options);
        Object.assign(this, options);
    }

    initModel(options){
        this.type = options.type;
        this.name = options.name;
        this.model= options.model;
    }
    //Assosiations
    set assosiations(new_assosiations) {this._assosiations = new_assosiations }
    get assosiations() {return this._assosiations}
    //Attributes
    set attributes(new_attributes) {this._attributes = new_attributes }
    get attributes() {return this._attributes}

    //Abilities
    set queryGetSingle(value) {this._queryGetSingle = value}
    set queryGetAll(value) {this._queryGetAll = value}
    set mutationCreate(value) {this._murationCreate = value}
    set mutationUpdate(value) {this._murationUpdate = value}
    set mutationDelete(value) {this._murationDelete = value}

    get queryGetSingle() { return this._queryGetSingle}
    get queryGetAll() { return this._queryGetAll}
    get mutationCreate() { return this._mutationCreate}
    get mutationUpdate() { return this._mutationUpdate}
    get mutationDelete() { return this._mutationDelete}

    set queries(value) { this._queries = value}
    set mutations(value) { this._mutations = value}
    set subscriptions(value) { this._subscriptions = value}

    get queries() {return this._getters}
    get mutations() {return this._mutations}
    get subscriptions() {return this._subscriptions}
    //Type
    set type(new_type) { this._type = new_type }
    get type() {return this._type }

    //Names
    set name(new_name) { this._name = new_name }
    get name(){ return this._name }
    get capName() { return util.capitalizeFirstLetter(this.name) }
    get pluralCapName() { return pluralize.plural(this.capName)}

    //query
    get queryGetSingleName(){return `get${this.capName}`}
    get queryGetAllName(){return `get${this.pluralCapName}`}
    //mutation
    get mutationCreateName() {return `create${this.capName}`}
    get mutationUpdateName() {return `update${this.capName}`}
    get mutationDeleteName() {return `delete${this.capName}`}
    //subscription

    //input
    get queryWhereInputName() {return `${this.capName}WhereInput`}
    get mutationCreateDataName() {return `${this.capName}CreateData`}
    get mutationUpdateDataName() {return `${this.capName}UpdateData`}
    get mutationUpdateWhereName() {return `${this.capName}UpdateWhere`}
    get mutationDeleteWhereName() {return `${this.capName}DeleteWhere`}


    can(value){
        switch(value){
            case 'getSingle':
                if(!this.queries || !this.queryGetSingle) return false;
                break;
            case 'getAll':
                if(!this.queries || !this.queryGetAll) return false;
                break;
            case 'create':
                if(!this.mutations || !this.mutationCreate) return false;
                break;
            case 'update':
                if(!this.mutations || !this.mutationUpdate) return false;
                break;
            case 'delete':
                if(!this.mutations || !this.mutationDelete) return false;
                break;
        }

        return true;
    }
}
module.exports.Model = Model;