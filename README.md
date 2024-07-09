# fhir-sparql-test
This is a declarative test suite for FHIR SPARQL.
FHIR SPARQL is a translation of SPARQL queries over a FHIR data to FHIR REST API queries.
This provides RDF access to FHIR data and improves FHIR apps by creating a declarative query orchestration that crosses FHIR Resource boundaries.

The algorithm converts a [query](./src/test/resources/org/uu3/obs-proc.srq) that spans FHIR Resources, e.g. Observation and Procedure:
``` SPARQL
SELECT ?obs ?proc ?patRsrc WHERE {
  # Observation
  ?obs a fhir:Observation ;                                           #  0

    # Observation.code
    fhir:code [                                                       #  1
      fhir:coding [                                                   #  2
        rdf:rest*/rdf:first [                                         #  3
          fhir:code [ fhir:v "72166-2" ] ;                            #  4/5
          fhir:system [ fhir:v "http://loinc.org"^^xsd:anyURI ]       #  6/7
        ]
      ]
    ] ;

      # Observation.subject
    fhir:subject [ fhir:reference [ fhir:link ?patRsrc ] ] .          #  8/9/10

  # Procedure
  ?proc a fhir:Procedure ;                                            # 11

    # Procedure.code
    fhir:code [                                                       # 12
      fhir:coding [                                                   # 13
        rdf:rest*/rdf:first [                                         # 14
          fhir:code [ fhir:v "724167008" ] ;                          # 15/16
          fhir:system [ fhir:v "http://snomed.info/sct"^^xsd:anyURI ] # 17/18
        ]
      ]
    ] ;

    # Procedure.subject   
    fhir:subject [ fhir:reference [ fhir:link ?patRsrc ] ] .          # 19/20/21
}
```
and breaks it up into multiple FHIR REST API queries that honor where possible the original constraints, e.g.
```
GET <FHIR endpoint>/Observation?code=http://loinc.org|72166-2
GET <FHIR endpoint>Procedure?subject=http://localhost:8080/hapi/fhir/Patient/2&code=http://snomed.info/sct|724167008
```
(assuming `Patient/2` was the only patient in the results that came back from the 1st GET).

## Implementations
This overview page covers the algorithm but the specific links to functions in the implementation(s) are found in their respecive READMEs:
* [fhir-sparql-js](../../../fhir-sparql-js#fhir-sparql-js) typescript implementation
* [fhir-sparql-java](../../../fhir-sparql/tree/main/fhir-sparql-common/src/main/java/org/example/fhir/cat) (not done) Java implementation
