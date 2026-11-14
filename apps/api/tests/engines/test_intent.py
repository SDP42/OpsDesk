import pytest

from app.engines.intent import suggest, train
from app.engines.intent_taxonomy import PARENTS, SUB_INTENTS, generate_corpus


@pytest.fixture(scope="module")
def model():
    return train(generate_corpus(seed=7))


def test_taxonomy_shape() -> None:
    assert len(PARENTS) == 10
    assert len(SUB_INTENTS) >= 25
    assert len(generate_corpus()) >= 1500


def test_accuracy_on_held_out_set(model) -> None:
    held_out = generate_corpus(per_intent=20, seed=99)
    correct = sum(1 for text, code in held_out if suggest(model, text).top[0].code == code)
    assert correct / len(held_out) >= 0.85


def test_returns_top_three_with_confidence(model) -> None:
    result = suggest(model, "Voucher not received for the Dubai booking, please resend")
    assert len(result.top) == 3
    assert result.top[0].code == "voucher.not_received"
    assert 0 < result.top[0].confidence <= 1


def test_refund_delay_override_rule(model) -> None:
    result = suggest(model, "Refund for TBOH-88213 still not received, asking again")
    assert result.top[0].code == "refund.delay"
    assert result.rule == "tboh_refund_delay"
    assert result.top[0].confidence >= 0.9


def test_short_text_needs_human(model) -> None:
    assert suggest(model, "hi").needs_human
