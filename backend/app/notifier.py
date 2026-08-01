import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
import requests


class Notifier:
    def __init__(self, config, logger):
        self.config = config
        self.logger = logger

    def send_alert(self, target_dict, alert_type):
        message = self._format_message(target_dict, alert_type)
        if self.config.get("console", {}).get("enabled", True):
            self._send_console(message, alert_type)
        if self.config.get("email", {}).get("enabled", False):
            self._send_email(target_dict, alert_type, message)
        if self.config.get("webhook", {}).get("enabled", False):
            self._send_webhook(target_dict, alert_type, message)

    def _format_message(self, target, alert_type):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        host_port = f"{target['host']}:{target['port']}" if target.get('port') else target['host']
        if alert_type == "DOWN":
            return (
                f"ALERT: {target['name']} is DOWN!\n"
                f"Host: {host_port} | Protocol: {target['protocol']}\n"
                f"Time: {timestamp} | Failures: {target['consecutive_failures']}\n"
                f"Uptime: {target['uptime_percentage']}%"
            )
        elif alert_type == "RECOVERED":
            return (
                f"RECOVERED: {target['name']} is back UP!\n"
                f"Host: {host_port} | Protocol: {target['protocol']}\n"
                f"Time: {timestamp} | Response: {target['last_response_time_ms']}ms\n"
                f"Uptime: {target['uptime_percentage']}%"
            )
        return f"ℹ️ {target['name']}: {alert_type}"

    def _send_console(self, message, alert_type):
        sep = "🚨" * 30 if alert_type == "DOWN" else "✅" * 30
        self.logger.info(f"\n{sep}\n{message}\n{sep}")

    def _send_email(self, target, alert_type, message):
        try:
            ec = self.config["email"]
            msg = MIMEMultipart("alternative")
            msg["From"] = ec["from"]
            msg["To"] = ", ".join(ec["to"])
            msg["Subject"] = f"[Network Monitor] {alert_type}: {target['name']}"
            color = "red" if alert_type == "DOWN" else "green"
            emoji = "🔴" if alert_type == "DOWN" else "🟢"
            html = f"""
            <html><body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;">
            <div style="max-width:600px;margin:auto;background:white;border-radius:8px;padding:20px;
                        border-top:5px solid {'red' if alert_type=='DOWN' else 'green'};">
              <h2 style="color:{color};">{emoji} {alert_type}: {target['name']}</h2>
              <table style="width:100%;border-collapse:collapse;">
                <tr style="background:#f9f9f9;"><td style="padding:8px;"><b>Host</b></td>
                    <td style="padding:8px;">{target['host']}:{target.get('port','N/A')}</td></tr>
                <tr><td style="padding:8px;"><b>Protocol</b></td>
                    <td style="padding:8px;">{target['protocol']}</td></tr>
                <tr style="background:#f9f9f9;"><td style="padding:8px;"><b>Response Time</b></td>
                    <td style="padding:8px;">{target['last_response_time_ms']}ms</td></tr>
                <tr><td style="padding:8px;"><b>Uptime</b></td>
                    <td style="padding:8px;">{target['uptime_percentage']}%</td></tr>
                <tr style="background:#f9f9f9;"><td style="padding:8px;"><b>Total Checks</b></td>
                    <td style="padding:8px;">{target['total_checks']}</td></tr>
              </table>
            </div></body></html>
            """
            msg.attach(MIMEText(message, "plain"))
            msg.attach(MIMEText(html, "html"))
            with smtplib.SMTP(ec["smtp_server"], ec["smtp_port"], timeout=15) as server:
                server.starttls()
                server.login(ec["username"], ec["password"])
                server.send_message(msg)
            self.logger.info(f"📧 Email sent for {target['name']}")
        except Exception as e:
            self.logger.error(f"Email failed: {e}")

    def _send_webhook(self, target, alert_type, message):
        try:
            url = self.config["webhook"]["url"]
            color = "#ff0000" if alert_type == "DOWN" else "#00cc44"
            payload = {
                "attachments": [{
                    "color": color,
                    "title": f"{alert_type}: {target['name']}",
                    "text": message,
                    "fields": [
                        {"title": "Host", "value": f"{target['host']}:{target.get('port','N/A')}", "short": True},
                        {"title": "Protocol", "value": target['protocol'], "short": True},
                        {"title": "Response Time", "value": f"{target['last_response_time_ms']}ms", "short": True},
                        {"title": "Uptime", "value": f"{target['uptime_percentage']}%", "short": True},
                    ],
                    "ts": int(datetime.now().timestamp()),
                }]
            }
            resp = requests.post(url, json=payload, timeout=10)
            self.logger.info(f"🔔 Webhook sent for {target['name']}: {resp.status_code}")
        except Exception as e:
            self.logger.error(f"Webhook failed: {e}")
