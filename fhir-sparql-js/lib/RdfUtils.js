const {Ns, Rdf, Fhir, FirstRest} = require('./Namespaces');
const SparqlJs = require('sparqljs');
const SparqlParser = new SparqlJs.Parser();

class RdfUtils {

  // debugging printer
  static ToTurtle (x) {
    if (x === null)
      return 'null';
    if ('subject' in x)
      return `${RdfUtils.ToTurtle(x.subject)} ${RdfUtils.ToTurtle(x.predicate)} ${RdfUtils.ToTurtle(x.object)} .`
    if (x.type === 'path')
      return x.value
      ? '<' + x.value + '>'
      : '(' + x.items.map(item => RdfUtils.pStr(item) + (item.pathType || '')).join('/') + ')' // TODO: not correct

    switch (x.termType) {
    case 'NamedNode': return '<' + x.value + '>';
    case 'BlankNode': return '_:' + x.value;
    case 'Variable': return '?' + x.value;
    case 'Literal': return '"' + x.value + '"' +
        (x.language
         ? '@' + x.language
         : x.datatype
         ? RdfUtils.ToTurtle(x.datatype)
         : '');
      // istanbul ignore next
    default: throw Error(`ToTurtle - unrecognized argument ${JSON.stringify(x)}`);
    }
  }

  /** find triples matching (s, p, o)
   */
  static getMatching (triplePatterns, s, p, o) {
    return triplePatterns.filter(tp =>
      (s === null || tp.subject.equals(s)) &&
      (p === null || tp.predicate.equals(p)) &&
      (o === null || tp.object.equals(o))
    );
  }

  /** remove triples matching (s, p, o)
   */
  static stealMatching (triplePatterns, s, p, o) {
    const ret = [];
    for (let i = 0; i < triplePatterns.length; ++i) {
      const tp = triplePatterns[i];
      if ((s === null || tp.subject.equals(s)) &&
          (p === null || tp.predicate.equals(p)) &&
          (o === null || tp.object.equals(o))) {
        ret.push(tp);
        triplePatterns.splice(i, 1);
        --i;
      }
    }
    return ret;
  }

  /** Stringize a predicate
   * Used to sort arcs queried from graphs.
   */
  static pStr (predicate) {
    return predicate.value
      ? '<' + predicate.value + '>'
      : '(' + predicate.items.map(item => RdfUtils.pStr(item) + (item.pathType || '')).join('/') + ')'; // TODO: not correct
  }

  static parseSparql (text) {
    // iQuery.where[0].triples
  }
}

class Term {
  constructor (termType, value) {
    this.termType = termType;
    this.value = value;
  }
  equals (r) {
    return this.termType === r.termType && this.value === r.value;
  }
  static blessSparqlJs (sparqlJsTerm) {
    if (sparqlJsTerm.type === 'path')
      return new Path(sparqlJsTerm.pathType, sparqlJsTerm.items.map(item => Term.blessSparqlJs(item)));

    switch (sparqlJsTerm.termType) {
    case 'NamedNode': return new NamedNode(sparqlJsTerm.value);
    case 'BlankNode': return new BlankNode(sparqlJsTerm.value);
    case 'Literal': return new Literal(sparqlJsTerm.value, sparqlJsTerm.language,
                                       sparqlJsTerm.datatype ? Term.blessSparqlJs(sparqlJsTerm.datatype) : undefined
                                      );
    case 'Variable': return new Variable(sparqlJsTerm.value);
    default: throw Error(`unknown SparqlJs term type in ${JSON.stringify(sparqlJsTerm)}`);
    }
  }
}

class NamedNode extends Term { constructor (value) { super('NamedNode', value); } toString() { return '<' + this.value + '>'; } }
class BlankNode extends Term { constructor (value) { super('BlankNode', value); } toString() { return '_:' + this.value; } }
class Variable  extends Term { constructor (value) { super('Variable', value); } toString() { return '?' + this.value; } }
class Literal   extends Term {
  constructor (value, language, datatype) {
    super('Literal', value);
    this.language = language;
    this.datatype = datatype;
  }
  toString () {
    return '"' + this.value + '"' +
      (this.language
       ? '@' + this.language
       : this.datatype
       ? '^^' + this.datatype.toString()
       : '');
  }
  equals (r) {
    return super.equals(r) && this.language === r.language && this.datatype === r.datatype;
  }
}

class Path {
  constructor (pathType, items) {
    this.type = 'path';
    this.pathType = pathType;
    this.items = items;
  }
  equals (r) {
    if (this.type !== r.type) return false;
    if (this.pathType !== r.pathType) return false;
    if (this.items.length !== r.items.length) return false;
    for (let i = 0; i < this.items.length; ++i)
      if (!this.items[i].equals(r.items[i]))
        return false;
    return true;
  }
}

class Triple {
  constructor (subject, predicate, object) {
    this.subject   = (subject);
    this.predicate = (predicate);
    this.object    = (object);
  }
  toString () {
    return `${this.subject} ${this.predicate} ${this.object} .`;
  }
  equals (r) {
    return this.subject.equals(r.subject) &&
      this.predicate.equals(r.predicate) &&
      this.object.equals(r.object);
  }
  static blessSparqlJs (sparqlJsTriple) {
    return new Triple(
      Term.blessSparqlJs(sparqlJsTriple.subject),
      Term.blessSparqlJs(sparqlJsTriple.predicate),
      Term.blessSparqlJs(sparqlJsTriple.object)
    );
  }
}

class Bgp {
  constructor (triples) {
    this.type = 'bgp';
    this.triples = triples;
  }
  toString (indent = '') {
    return indent + '{\n' + this.triples.map(t => indent + '  ' + t.toString() + '\n').join('') + '}';
  }
  static blessSparqlJs (sparqlJsBgp) {
    if (sparqlJsBgp.type !== 'bgp') throw Error(`expected to bless something with .type=bgp in ${JSON.stringify(sparqlJsBgp)}`);
    return new Bgp(sparqlJsBgp.triples.map(t => Triple.blessSparqlJs(t)));
  }
}

class SparqlQuery {
  constructor (query) {
    // query.where[0].triples = query.where[0].triples.map(t => Triple.blessSparqlJs(t));
    query.where = query.where.map(bgp => Bgp.blessSparqlJs(bgp));
    this.query = query;
  }

  getQuery () { return this.query; }
  getWhere () { return this.query.where; };

  static parse (text) {
    return new SparqlQuery(SparqlParser.parse(text));
  }
}

module.exports = {RdfUtils, Term, SparqlQuery};
