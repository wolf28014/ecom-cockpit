"""测试 AI 服务真实调用 GLM-4"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database.connection import init_db, get_session
from app.core.ai_service import AIService

init_db()

print("=" * 60)
print("【测试 1】AI 老板助手对话")
print("=" * 60)
with get_session() as session:
    svc = AIService(session)
    answer = svc.boss_chat(store_id=1, question="为什么我今天的利润比昨天低？")
    print(answer[:500])

print("\n" + "=" * 60)
print("【测试 2】AI 经营建议")
print("=" * 60)
with get_session() as session:
    svc = AIService(session)
    report = svc.generate_suggestions(store_id=1)
    print(f"报告标题: {report.title}")
    print(f"报告摘要: {report.summary}")
    print(f"\n报告正文（前 800 字）:")
    print(report.content[:800])
