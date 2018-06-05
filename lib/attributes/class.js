const _ = require('lodash');
const pluralize                                   = require('pluralize');
const util = require('../util');


class Attribute {
    constructor(options){
        let defaults = {
            name:null,
            schemaType:null,
            relation:'one',//opts one or many
            actual:null,
            type:'property',//opts property or assosiation
            parentType:null,//mongoose or sequelize

            paramOptions:{
                getSingle:true,
                getAll:true,
                createData:true,
                updateData:true,
                updateWhere:true,
                deleteWhere:true,
            }
        };
        options = Object.assign({}, defaults, options);
        Object.assign(this, options);

        this.initParams();
        for(let param in options.paramOptions){
            let value = options.paramOptions[param];
            this.updateParamOpt(param, value);
        }

    }

    set name(value){this._name = value}
    get name(){return this._name}

    set schemaType(value) { this._schemaType = util.capitalizeFirstLetter(value) }
    get schemaType() {return this._schemaType}

    get modelReference() {return this._modelReference}

    set relation(value) {this._relation = value}
    get relation(){return this._relation}

    set actual(value) {this._actual = value}
    get actual() {return this._actual}

    set type(value) {this._type = value}
    get type() {return this._type}

    set parentType(value) {this._parentType = value}
    get parentType() {return this._parentType}

    get inputName() { return this.name }
    //abilities
    set parameterOptions(v){this._parameterOptions = v}
    get parameterOptions(){return this._parameterOptions}


    initParams(){
        this.parameterOptions = {
            getSingle: true,
            getAll:true,
            createData:true,
            updateData:true,
            updateWhere:true,
            deleteWhere:true,
        }
    }
    updateParamOpt(name, value){
        if(typeof this.parameterOptions[name] === 'undefined') throw `Parameter option ${name} does not exist`;
        this.parameterOptions[name] = value;
    }

    isParam(name){
        if(typeof this.parameterOptions[name] === 'undefined') throw `Parameter option ${name} does not exist`;
        return this.parameterOptions[name]
    }


    makeRowStr(whereName){
        let str = `\t${this.name}`;

        let schemaType = this.schemaType;
        if(this.relation === 'many'){
            schemaType = `[${schemaType}]`
        }
        if(whereName){
            str += ` (where:${whereName}, `;

            if(this.relation === 'many'){
                str += `limit: Int, offset: Int`;
            }

            str += `): ${schemaType}\n`;
        }else{
            str += `: ${schemaType}\n`
        }

        return str;
    }
}

module.exports.Attribute = Attribute;
