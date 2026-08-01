import json
import os
from datetime import datetime


class Reporter:
    def __init__(self, report_path, logger):
        self.report_path = report_path
        self.logger = logger
        os.makedirs(os.path.dirname(report_path), exist_ok=True)

    def generate_report(self, statuses):
        total = len(statuses)
        up = sum(1 for t in statuses.values() if t.get("is_up") is True)
        down = sum(1 for t in statuses.values() if t.get("is_up") is False)
        unknown = sum(1 for t in statuses.values() if t.get("is_up") is None)
        uptimes = [t["uptime_percentage"] for t in statuses.values() if t["total_checks"] > 0]
        avg_uptime = round(sum(uptimes) / len(uptimes), 2) if uptimes else 0.0

        report = {
            "generated_at": datetime.now().isoformat(),
            "summary": {
                "total_targets": total,
                "up": up,
                "down": down,
                "unknown": unknown,
                "average_uptime_percentage": avg_uptime,
                "currently_down": [
                    {"name": t["name"], "host": t["host"], "port": t["port"]}
                    for t in statuses.values() if t.get("is_up") is False
                ],
            },
            "targets": statuses,
        }

        try:
            with open(self.report_path, "w") as f:
                json.dump(report, f, indent=2, default=str)
        except Exception as e:
            self.logger.error(f"Report write failed: {e}")
