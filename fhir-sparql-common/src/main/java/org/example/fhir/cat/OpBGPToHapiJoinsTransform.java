package org.example.fhir.cat;

import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.stream.Collectors;

import org.apache.jena.graph.Node;
import org.apache.jena.graph.Triple;
import org.apache.jena.sparql.algebra.Op;
import org.apache.jena.sparql.algebra.TransformCopy;
import org.apache.jena.sparql.algebra.op.OpBGP;
import org.apache.jena.sparql.algebra.op.OpJoin;
import org.apache.jena.sparql.core.BasicPattern;

import ca.uhn.fhir.rest.client.api.IGenericClient;

public class OpBGPToHapiJoinsTransform extends TransformCopy {
	private final IGenericClient client;

	public OpBGPToHapiJoinsTransform(IGenericClient client) {
		super();
		this.client = client;
	}

	@Override
	public Op transform(OpBGP opBGP) {
		BasicPattern bgp = opBGP.getPattern();
		Op join = null;
		Map<Node, List<Triple>> collect = bgp.getList().stream().collect(Collectors.groupingBy(Triple::getSubject));
		if (collect.size() > 0) {
			return new HapiBgpOp(opBGP, client);
		} else {
			Iterator<Entry<Node, List<Triple>>> iterator = collect.entrySet().iterator();

			join = newHapiBgpOpFrom(iterator.next(), client);
			while (iterator.hasNext()) {
				join = OpJoin.create(join, newHapiBgpOpFrom(iterator.next(), client));
			}
		}
		if (join == null) {
			return opBGP;
		} else {
			return join;
		}
	}

	private HapiBgpOp newHapiBgpOpFrom(Entry<Node, List<Triple>> next, IGenericClient client2) {

		return new HapiBgpOp(new OpBGP(BasicPattern.wrap(next.getValue())), client2);
	}
}
