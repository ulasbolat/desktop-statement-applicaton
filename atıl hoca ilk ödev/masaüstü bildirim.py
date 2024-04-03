import sys

from PyQt5.QtCore import Qt
from PyQt5.QtWidgets import QApplication, QMainWindow, QLineEdit , QPushButton


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("My Application")
        self.resize(400,300)

        self.text_field = QLineEdit(self)
        self.text_field.move(20, 20)

        self.button = QPushButton("Click me!",self)
        self.button.move(20, 60)
        self.button.clicked.connect(self.on_button_click)

    def on_click_button(self):
        print("Button clicked!")
        print("Text field value:",self.text_field.text())

app = QApplication(sys.argv)
window = MainWindow()
window.show()
sys.exit(app.exec_())




